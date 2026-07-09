# GPU 驱动学习路线：从 API hook 到驱动候选人

这条路线面向当前背景：

- 已经了解一部分 Vulkan / OpenGL
- 做过在 hook 层拦截游戏管线调用
- 后续可能转向 GPU 厂的驱动开发、图形栈、游戏兼容性或 GPU 虚拟化方向

核心目标不是“看完很多资料”，而是每一阶段都留下可以展示的证据：

```text
一个工具
一篇分析
一个实验记录
一个小 patch
一组可复现命令
```

## 总路线

优先级建议：

```text
Vulkan / GL API 深化
> 图形调试与 trace 工具
> Mesa 用户态驱动
> Linux DRM / KMS / GPU 内核驱动
> PCIe / DMA / IOMMU
> GPU 虚拟化
```

不要一开始就把 GPU 虚拟化当主线。它很重要，但更像是在 UMD/KMD、内存管理、IOMMU、设备模型都稍微站稳之后再上的一层。

## 0. 先搭工作台

推荐准备一个 Linux 环境。Ubuntu、Fedora、Arch 都可以。Windows 也能学 Vulkan 和 RenderDoc，但 Mesa、DRM/KMS、kernel driver 实验在 Linux 上顺手很多。

常用工具：

```bash
vulkaninfo
vkcube
vkconfig
renderdoc
gfxrecon-capture
gfxrecon-replay
apitrace
drm_info
modetest
igt-gpu-tools
qemu-system-x86_64
```

注意：学习阶段尽量用自己的 demo、Khronos Samples、开源 demo 或可公开复现的样例。不要把商业游戏的 hook log、capture、shader、trace 作为公开作品集素材，反作弊和 EULA 风险都很麻烦。

## 1. Vulkan / GL API 层：把 hook 经验升级成 driver 视角

目标不是再写一个普通 Vulkan demo，而是理解 API 调用会给驱动带来什么压力。

重点概念：

- Vulkan synchronization：fence、semaphore、timeline semaphore、barrier、queue ownership
- Vulkan memory：heap、memory type、mapping、staging、aliasing、dedicated allocation
- command buffer：record、submit、reset、reuse、secondary command buffer
- pipeline：pipeline cache、shader compilation、PSO 创建成本
- descriptor：descriptor set、dynamic offset、bindless、update 频率
- WSI / swapchain / present path
- GL 状态机：state validation、draw call batching、shader variant、FBO、texture residency

官方和实用资料：

- Vulkan Guide: https://docs.vulkan.org/guide/latest/index.html
- Vulkan Tutorial: https://docs.vulkan.org/tutorial/latest/00_Introduction.html
- Khronos Vulkan Samples: https://github.com/KhronosGroup/Vulkan-Samples
- Vulkan synchronization examples: https://github.com/KhronosGroup/Vulkan-Docs/wiki/Synchronization-Examples
- LunarG Vulkan SDK / vkconfig / validation layers: https://vulkan.lunarg.com/doc/sdk
- RenderDoc: https://renderdoc.org/docs/
- GFXReconstruct: https://github.com/LunarG/gfxreconstruct
- apitrace: https://github.com/apitrace/apitrace

动手任务：

1. 编译并运行 Vulkan Samples。
2. 用 RenderDoc 抓一帧，手动看 command list、pipeline、descriptor、barrier、render target。
3. 用 GFXReconstruct 抓一个 Vulkan demo，并 replay。
4. 写或改一个 Vulkan layer，统计每帧：
   - `vkQueueSubmit` 次数
   - `vkCreateGraphicsPipelines` 次数
   - `vkUpdateDescriptorSets` 次数
   - barrier 数量和类型
   - image layout transition
   - memory allocation / free
5. 输出一份 frame report，回答：
   - 哪些帧 submit 过多？
   - 哪些帧 pipeline 创建异常？
   - 哪些 barrier 可能是保守或冗余的？
   - 是否存在运行时频繁 allocation？

阶段产出：

```text
docs/graphics/frame-analyzer-report.md
tools/vulkan-frame-analyzer/
```

能讲清楚这一层，已经接近 GPU 厂里的游戏兼容性、性能分析、图形工具、用户态驱动岗位。

## 2. Mesa 用户态驱动：把 API 调用和驱动实现接起来

目标是知道 `vkQueueSubmit`、`vkCreateGraphicsPipelines`、buffer/image/memory 在开源 UMD 里怎么落地。

重点概念：

- Vulkan loader / layer / ICD
- Mesa Vulkan runtime
- RADV / ANV / NVK / Lavapipe 的位置
- NIR shader IR
- shader compile pipeline：SPIR-V -> NIR -> backend
- winsys、buffer object、kernel ioctl
- pipeline cache、descriptor lowering、command emission

资料：

- Mesa 文档: https://docs.mesa3d.org/
- Mesa 编译安装: https://docs.mesa3d.org/install.html
- Mesa Vulkan drivers: https://docs.mesa3d.org/vulkan/index.html
- Mesa NIR: https://docs.mesa3d.org/nir/index.html
- Mesa Gallium: https://docs.mesa3d.org/gallium/index.html
- Mesa environment variables: https://docs.mesa3d.org/envvars.html
- RADV: https://docs.mesa3d.org/drivers/radv.html
- Venus: https://docs.mesa3d.org/drivers/venus.html

动手任务：

1. 本地编译 Mesa，先跑 lavapipe，不依赖特定 GPU。
2. 用本地 Mesa 跑：

```bash
vulkaninfo
vkcube
```

3. 给 Mesa 某个 Vulkan driver 路径加 log，先从 lavapipe 或自己机器对应的开源 driver 入手。
4. 跟一遍这些路径：
   - device 创建
   - buffer / image 创建
   - memory allocation
   - graphics pipeline 创建
   - shader 从 SPIR-V 进入 NIR
   - queue submit
5. 写一篇路径分析：

```text
Game / demo
-> Vulkan loader
-> ICD
-> Mesa Vulkan driver
-> winsys / libdrm
-> kernel ioctl
```

阶段产出：

```text
docs/graphics/mesa-vkqueuesubmit-path.md
docs/graphics/spirv-to-nir-notes.md
patches/mesa-debug-log.patch
```

判断标准：

```text
看到一个 Vulkan 调用时，我能说出它大概率会进入 Mesa 的哪类模块。
看到一个 shader 时，我知道它会经历 SPIR-V、NIR、backend 的哪几步。
看到一个 buffer 时，我知道它不是普通 malloc，而是会牵涉 GPU 可见内存和 kernel 对象。
```

## 3. Linux DRM / KMS / GPU 内核层

目标是理解用户态 driver 最后如何通过 ioctl、GEM/TTM、fence、scheduler 进入内核。

重点概念：

- DRM device / render node / primary node
- KMS：CRTC、plane、connector、encoder、atomic commit
- GEM / TTM：buffer object 管理
- dma-buf：跨进程、跨设备共享 buffer
- syncobj / fence：CPU/GPU、GPU/GPU 同步
- GPU scheduler、job、ring、queue
- hang detection、reset、recovery
- VRAM / GTT / GPU VA / page table

资料：

- Linux GPU driver documentation: https://docs.kernel.org/gpu/index.html
- DRM/KMS documentation: https://docs.kernel.org/gpu/drm-kms.html
- DRM memory management: https://docs.kernel.org/gpu/drm-mm.html
- VKMS: https://docs.kernel.org/gpu/vkms.html
- dma-buf: https://docs.kernel.org/driver-api/dma-buf.html
- Linux Kernel Labs: https://linux-kernel-labs.github.io/
- Bootlin Linux kernel training: https://bootlin.com/training/kernel/
- IGT GPU Tools: https://drm.pages.freedesktop.org/igt-gpu-tools/
- libdrm: https://gitlab.freedesktop.org/mesa/drm

动手任务：

1. 写一个最小 kernel module。
2. 写一个 char device，练习：
   - `open`
   - `read`
   - `write`
   - `ioctl`
   - `mmap`
3. 加载 VKMS：

```bash
sudo modprobe vkms
drm_info
modetest
```

4. 跑几个 IGT KMS 测试。
5. 改 VKMS，加一个 debug counter，例如：
   - atomic commit 次数
   - page flip 次数
   - vblank 次数
6. 写一个最小 libdrm 程序：
   - 打开 DRM device
   - 创建 dumb buffer
   - modeset
   - page flip

阶段产出：

```text
docs/graphics/drm-kms-vkms-notes.md
patches/vkms-debug-counter.patch
tools/drm-dumb-buffer-demo/
```

判断标准：

```text
我知道 RenderDoc 里看到的一帧，最后不是神秘地进 GPU。
它会变成 buffer、command、sync object、kernel submission、interrupt、fence。
```

## 4. PCIe / DMA / IOMMU：底层驱动地基

这一层是 GPU 厂底层驱动和虚拟化岗位很常问的基础。

重点概念：

- PCI config space
- BAR / MMIO
- MSI / MSI-X
- DMA coherent mapping
- DMA streaming mapping
- cache coherency
- IOMMU / IOVA
- device reset / FLR
- interrupt handler / threaded irq

资料：

- Linux PCI documentation: https://docs.kernel.org/PCI/index.html
- Linux PCI driver API: https://docs.kernel.org/driver-api/pci/index.html
- DMA API HOWTO: https://www.kernel.org/doc/Documentation/DMA-API-HOWTO.txt
- Linux DMA API: https://docs.kernel.org/core-api/dma-api.html
- x86 IOMMU documentation: https://docs.kernel.org/arch/x86/iommu.html

动手任务：

1. 用 `lspci -vvv` 看自己机器上的 GPU、网卡、NVMe：

```bash
lspci -nn
lspci -vvv -s <device>
```

2. 找出：
   - BAR
   - MSI/MSI-X
   - IOMMU group
   - driver binding
3. 写一个笔记解释：

```text
CPU 访问设备寄存器为什么用 MMIO？
设备访问内存为什么要 DMA？
IOMMU 在普通系统和虚拟化里分别解决什么问题？
为什么 GPU driver 需要 fence 和 interrupt？
```

4. 如果有合适硬件或 QEMU 环境，再练一个简单 PCI driver。

阶段产出：

```text
docs/graphics/pci-dma-iommu-notes.md
```

判断标准：

```text
能把 BAR、MMIO、DMA、IOMMU、MSI-X、FLR 用自己的话讲清楚。
能说明它们和 GPU command submission、memory management、虚拟化有什么关系。
```

## 5. GPU 虚拟化：最后再系统学习

目标是分清几种模型，而不是背名词。

核心模型：

```text
PCI passthrough:
  一整张 GPU 直接给一个 VM。
  关键是 VFIO、IOMMU、device reset、interrupt remapping。

SR-IOV:
  一个 PF 暴露多个 VF，让多个 VM 或容器共享硬件能力。
  关键是 PF/VF、resource partition、security isolation。

mdev / vGPU:
  host driver 创建 mediated device。
  guest 看到一个虚拟 GPU，host 负责调度和资源隔离。

virtio-gpu:
  guest 看到 virtio GPU。
  适合学习虚拟 GPU 设备模型、display、VirGL、Venus。

GPU-P / paravirtualization:
  Windows 生态里的 GPU 分区/半虚拟化方向。
```

资料：

- QEMU virtio-gpu: https://www.qemu.org/docs/master/system/devices/virtio/virtio-gpu.html
- Mesa Venus: https://docs.mesa3d.org/drivers/venus.html
- VFIO mediated device: https://docs.kernel.org/driver-api/vfio-mediated-device.html
- PCI SR-IOV: https://docs.kernel.org/PCI/pci-iov-howto.html
- Linux VFIO: https://docs.kernel.org/driver-api/vfio.html

动手任务：

1. 用 QEMU 启一个 Linux guest，使用 virtio-gpu。
2. guest 里跑：

```bash
drm_info
modetest
vkcube
kmscube
```

3. 对比三种路径：

```text
host native Vulkan
guest virtio-gpu display
guest Venus / VirGL acceleration
```

4. 写一篇对比：

```text
passthrough、SR-IOV、mdev、virtio-gpu 分别解决什么问题？
为什么 IOMMU 是 GPU 虚拟化的安全基础？
虚拟化场景下 command submission、memory、fence 会变复杂在哪里？
```

阶段产出：

```text
docs/graphics/gpu-virtualization-notes.md
```

判断标准：

```text
不把 vGPU、SR-IOV、virtio-gpu、passthrough 混成一个东西。
能说出每种方案的性能、隔离、兼容性和实现复杂度差异。
```

## 6. 面向岗位的作品集

不要只写“学习了 GPU 驱动”。更有说服力的是三类证据。

### 作品 1：Vulkan / GL frame analyzer

输入：

```text
Vulkan layer log
GFXReconstruct trace
RenderDoc capture 的人工分析
```

输出：

```text
每帧 submit 数量
pipeline 创建热点
descriptor update 热点
barrier / layout transition 统计
memory allocation 统计
一份优化建议
```

对应岗位：

```text
游戏兼容性
图形性能分析
用户态驱动
图形调试工具
```

### 作品 2：Mesa 路径分析

主题：

```text
vkQueueSubmit 从应用到 Mesa 再到 kernel ioctl 的路径
SPIR-V 到 NIR 的 shader 编译路径
buffer / image / memory object 的生命周期
```

对应岗位：

```text
用户态图形驱动
Vulkan runtime
shader compiler 入门
```

### 作品 3：DRM/KMS 小实验

主题：

```text
VKMS debug counter
libdrm dumb buffer demo
IGT 测试记录
DRM atomic commit 路径分析
```

对应岗位：

```text
Linux GPU kernel driver
display driver
kernel graphics stack
```

## 7. 12 周执行节奏

第 1-3 周：Vulkan / GL hook 升级

```text
目标：做出 frame analyzer 原型。
结果：能用自己的工具解释一帧里发生了什么。
```

第 4-7 周：Mesa 用户态驱动

```text
目标：编译 Mesa，跑 lavapipe，跟踪 3-5 条关键路径。
结果：写出 Mesa Vulkan 调用路径分析。
```

第 8-10 周：Linux DRM / KMS

```text
目标：跑 VKMS、drm_info、modetest、IGT，改一个小 debug counter。
结果：写出 DRM/KMS 实验记录。
```

第 11-12 周：PCI/DMA/IOMMU + GPU 虚拟化入门

```text
目标：讲清楚 PCIe/DMA/IOMMU，跑一个 virtio-gpu guest。
结果：写出 GPU 虚拟化对比笔记。
```

## 8. 每周最小闭环

每周只问四件事：

```text
1. 本周我实际跑通了什么命令？
2. 本周我读懂了哪一条调用路径？
3. 本周我留下了什么可展示证据？
4. 下周只推进哪一个实验？
```

如果一周结束什么代码、命令、截图、patch、笔记都没有，就说明又回到了“想方向但不产出”。这时不要扩大计划，缩小到一个最小实验。

## 9. 面试高频问题清单

API / UMD：

- Vulkan layer、loader、ICD 的关系是什么？
- fence、binary semaphore、timeline semaphore 有什么区别？
- pipeline cache 解决什么问题？
- descriptor update 为什么可能成为 CPU overhead？
- GL driver 为什么需要大量 state validation？

Shader：

- SPIR-V 和 NIR 分别是什么？
- shader variant 为什么会爆炸？
- 编译 pipeline 为什么会影响游戏卡顿？

KMD / DRM：

- GEM 和 TTM 分别解决什么问题？
- dma-buf 解决什么跨进程/跨设备问题？
- fence 在 CPU/GPU 同步里扮演什么角色？
- GPU hang 怎么检测和恢复？
- render node 和 primary node 有什么区别？

PCI / DMA：

- BAR / MMIO 是什么？
- DMA mapping 为什么不能直接拿 CPU virtual address？
- coherent DMA 和 streaming DMA 有什么区别？
- IOMMU 在普通系统和虚拟化里分别解决什么？
- MSI-X 和传统中断有什么区别？

虚拟化：

- passthrough、SR-IOV、mdev、virtio-gpu 的区别是什么？
- 为什么 GPU passthrough 需要 IOMMU？
- SR-IOV 的 PF/VF 是什么？
- vGPU 的调度和隔离难点在哪里？

## 10. 第一份 14 天实验

如果现在就开始，建议第一轮不要碰虚拟化，先做最贴近现有经验的东西。

实验题目：

```text
做一个 Vulkan frame analyzer 原型。
```

14 天后要拿出的证据：

```text
1. 一个可以运行的 Vulkan layer 或 hook demo
2. 一份 demo trace
3. 一份 frame report
4. 一篇笔记：这些 API 调用如何映射到驱动压力
```

每天最小动作：

```text
第 1 天：跑通 Vulkan Samples 和 RenderDoc
第 2 天：跑通 GFXReconstruct capture/replay
第 3 天：搭 Vulkan layer 骨架
第 4 天：统计 vkQueueSubmit
第 5 天：统计 pipeline create
第 6 天：统计 descriptor update
第 7 天：统计 barrier / layout transition
第 8 天：统计 memory allocation
第 9 天：整理日志格式
第 10 天：选一个 demo 做完整采集
第 11 天：写 frame report 草稿
第 12 天：补图表或表格
第 13 天：写驱动压力分析
第 14 天：整理成作品集页面
```

这轮做完，再决定第二轮是 Mesa 路径分析，还是 VKMS/DRM 实验。
