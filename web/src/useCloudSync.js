import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeData } from "./data.js";
import { isSupabaseConfigured, supabase } from "./supabase.js";

const INITIAL_STATUS = isSupabaseConfigured ? "signed_out" : "disabled";

function clearAuthCallbackParams() {
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  const hasAuthParams = url.searchParams.has("code")
    || url.searchParams.has("error")
    || hash.has("access_token")
    || hash.has("refresh_token")
    || hash.has("error_description");

  if (!hasAuthParams) return;
  url.searchParams.delete("code");
  url.searchParams.delete("error");
  url.searchParams.delete("error_code");
  url.searchParams.delete("error_description");
  url.hash = "";
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);
}

export function useCloudSync({ data, setData, onMessage }) {
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState(INITIAL_STATUS);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const latestDataRef = useRef(data);
  const applyingRemoteRef = useRef(false);
  const hydratedUserRef = useRef(null);
  const hydratingUserRef = useRef(null);
  const lastWriteAtRef = useRef(null);
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    latestDataRef.current = data;
  }, [data]);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const pushSnapshot = useCallback(async (user, snapshot) => {
    if (!supabase || !user) return false;
    if (!navigator.onLine) {
      setStatus("offline");
      return false;
    }

    setStatus("saving");
    setErrorMessage("");
    const updatedAt = new Date().toISOString();
    lastWriteAtRef.current = updatedAt;
    const { error } = await supabase.from("user_state").upsert(
      {
        user_id: user.id,
        data: snapshot,
        updated_at: updatedAt,
      },
      { onConflict: "user_id" },
    );

    if (error) {
      lastWriteAtRef.current = null;
      setStatus("error");
      setErrorMessage(error.message);
      return false;
    }

    setLastSyncedAt(updatedAt);
    setStatus("synced");
    return true;
  }, []);

  const pullRemote = useCallback(async (user) => {
    if (!supabase || !user) return;
    setStatus("loading");
    setErrorMessage("");

    const { data: row, error } = await supabase
      .from("user_state")
      .select("data, updated_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    if (row?.data) {
      applyingRemoteRef.current = true;
      setData(normalizeData(row.data));
      setLastSyncedAt(row.updated_at || null);
      setStatus("synced");
    } else {
      await pushSnapshot(user, latestDataRef.current);
    }

    hydratedUserRef.current = user.id;
  }, [pushSnapshot, setData]);

  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;

    supabase.auth.getSession().then(({ data: result }) => {
      if (active) {
        setSession(result.session || null);
        clearAuthCallbackParams();
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (active) {
        setSession(nextSession || null);
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          clearAuthCallbackParams();
        }
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const user = session?.user;
    if (!user) {
      hydratedUserRef.current = null;
      hydratingUserRef.current = null;
      setStatus(isSupabaseConfigured ? "signed_out" : "disabled");
      return;
    }
    if (hydratedUserRef.current === user.id || hydratingUserRef.current === user.id) return;

    hydratingUserRef.current = user.id;
    pullRemote(user).finally(() => {
      hydratingUserRef.current = null;
    });
  }, [pullRemote, session]);

  useEffect(() => {
    const user = session?.user;
    if (!supabase || !user) return undefined;

    const channel = supabase
      .channel(`user-state-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_state",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new;
          if (!row?.data || row.updated_at === lastWriteAtRef.current) return;
          applyingRemoteRef.current = true;
          setData(normalizeData(row.data));
          setLastSyncedAt(row.updated_at || new Date().toISOString());
          setStatus("synced");
          onMessageRef.current?.("已收到另一台设备的更新");
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, setData]);

  useEffect(() => {
    const user = session?.user;
    if (!user || hydratedUserRef.current !== user.id) return undefined;
    if (applyingRemoteRef.current) {
      applyingRemoteRef.current = false;
      return undefined;
    }
    if (!navigator.onLine) {
      setStatus("offline");
      return undefined;
    }

    setStatus("pending");
    const timer = window.setTimeout(() => {
      pushSnapshot(user, data);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [data, pushSnapshot, session]);

  useEffect(() => {
    const onOffline = () => setStatus("offline");
    const onOnline = () => {
      if (session?.user) pushSnapshot(session.user, latestDataRef.current);
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [pushSnapshot, session]);

  const sendMagicLink = async (email) => {
    if (!supabase) return { ok: false, message: "Supabase 尚未配置" };
    setStatus("loading");
    setErrorMessage("");
    const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return { ok: false, message: error.message };
    }
    setStatus("link_sent");
    return { ok: true };
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
    setStatus("signed_out");
  };

  const syncNow = async () => {
    if (!session?.user) return false;
    return pushSnapshot(session.user, latestDataRef.current);
  };

  return {
    configured: isSupabaseConfigured,
    session,
    user: session?.user || null,
    status,
    lastSyncedAt,
    errorMessage,
    sendMagicLink,
    signOut,
    syncNow,
  };
}
