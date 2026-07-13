# CUDA 和 GPU 架构临时补强

这份补充用于回答一个很现实的问题：

```text
转向 GPU 厂驱动相关岗位时，是否需要了解 CUDA 和 GPU 架构？
```

结论：需要，但不需要临时把自己训练成 CUDA 算法工程师。更合理的目标是把以前 Tegra X1 声纳项目里的 CUDA 并行经验重新捡起来，并翻译成 GPU 架构、内存、调度、profiling、性能瓶颈分析这些驱动岗位也听得懂的语言。

## 1. 为什么值得补

你已有的背景是：

- 做过 Vulkan / GL hook，接触图形 API 调用路径
- 很久以前做过 Tegra X1 声纳项目
- 用 CUDA 做过并行运算
- 可能涉及 TopN / TopK 这类选择问题

这对 GPU 厂不是无关经历。它可以被整理成三类能力：

```text
图形 API 侧：知道应用如何把 workload 交给 GPU
CUDA 侧：知道 compute workload 如何组织线程、内存和同步
驱动侧：知道这些 workload 最后都会落到 command、memory、queue、fence、scheduler、profiling 上
```

如果目标是 display driver，CUDA 不是主线；如果目标是用户态驱动、性能分析、compute runtime、数据中心 GPU、嵌入式 GPU、AI/HPC 相关驱动，CUDA 和 GPU 架构就很加分。

## 2. 只补这些核心概念

### GPU 执行模型

必须能讲清楚：

- host / device
- kernel launch
- grid / block / thread
- warp / SIMT
- SM / SMM
- occupancy
- register pressure
- warp divergence
- instruction latency hiding

最小判断标准：

```text
为什么 GPU 不是“很多 CPU 核”？
为什么一个 kernel 快不快，不只看线程数？
为什么分支、寄存器、访存模式会影响 occupancy 和吞吐？
```

### CUDA 内存层次

必须能讲清楚：

- global memory
- shared memory
- local memory
- constant / texture memory
- register
- L1 / L2 cache
- coalesced access
- shared memory bank conflict
- pinned memory
- unified memory
- zero-copy

和 Tegra X1 相关的重点：

```text
Tegra / Jetson 是 integrated GPU，不是传统 x86 + discrete GPU。
CPU 和 GPU 共享系统内存，数据拷贝、cache coherency、zero-copy、unified memory 的取舍和 dGPU 不完全一样。
```

### CUDA 同步和调度

必须能讲清楚：

- `__syncthreads`
- atomic
- stream
- event
- async memcpy
- overlap copy and compute
- runtime API vs driver API
- PTX / SASS / JIT

和驱动路线的连接：

```text
Vulkan 里有 queue、semaphore、fence、barrier。
CUDA 里有 stream、event、kernel dependency、memory dependency。
底层都绕不开 command submission、同步、内存可见性和调度。
```

## 3. Tegra X1 这段经历怎么重新包装

Tegra X1 / Jetson TX1 的关键词：

- Maxwell 架构
- 256 CUDA cores
- embedded / low-power SoC
- integrated GPU
- CPU 和 GPU 共享系统内存
- 适合 computer vision、sensor processing、embedded GPU compute

不要只说：

```text
我以前用 CUDA 做过声纳项目。
```

要改成：

```text
我在 Tegra X1 这类 embedded iGPU 上做过 CUDA 并行计算，关注过数据从传感器输入到 GPU kernel 的处理链路、访存模式、并行归约/TopK、CPU/GPU 同步和端到端延迟。
```

这句话和 GPU 驱动岗位的关系更强。

## 4. TopN / TopK 应该补到什么程度

TopN / TopK 不需要一上来手写复杂论文算法。先把问题分层。

常见方案：

```text
全量 sort:
  简单，但 N 很大时浪费。

partial selection:
  适合只要前 K 个，不关心全量排序。

block local TopK + global merge:
  每个 block 先选局部 TopK，再做二阶段合并。

radix sort / radix select:
  对整数、定点数、可排序 key 很常用。

threshold + compaction + TopK:
  信号处理里常见，先过滤候选，再排序/选择。

CUB / Thrust:
  工程上优先用成熟库，再针对瓶颈手写 kernel。
```

你需要能讨论这些 tradeoff：

- K 很小还是很大？
- 输入是 float、int、pair、complex magnitude 还是结构体？
- 需要稳定排序吗？
- 只要 value，还是要 value + index？
- 是单帧 TopK，还是很多 batch 的 TopK？
- 数据是否已经在 GPU 上？
- 端到端瓶颈在 kernel，还是在 CPU/GPU 传输和同步？

对声纳场景可以这样抽象：

```text
input samples
-> window/filter
-> magnitude / energy
-> threshold
-> local peaks
-> TopN candidates
-> CPU or downstream GPU stage
```

## 5. 推荐资料

官方资料优先：

- CUDA Programming Guide: https://docs.nvidia.com/cuda/cuda-programming-guide/index.html
- CUDA C++ Best Practices Guide: https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/index.html
- CUDA for Tegra Application Note: https://docs.nvidia.com/cuda/cuda-for-tegra-appnote/index.html
- Nsight Compute: https://docs.nvidia.com/nsight-compute/NsightCompute/index.html
- Nsight Systems: https://docs.nvidia.com/nsight-systems/UserGuide/index.html
- CUDA Samples: https://github.com/NVIDIA/cuda-samples
- CUB: https://nvidia.github.io/cccl/cub/
- Thrust: https://nvidia.github.io/cccl/thrust/
- Jetson TX1: https://developer.nvidia.com/embedded/jetson-tx1

阅读顺序：

```text
CUDA Programming Guide:
  Programming Model
  Writing SIMT Kernels
  Asynchronous Execution
  Unified and System Memory
  CUDA Driver API
  Compute Capabilities

CUDA Best Practices:
  Application Profiling
  Memory Optimizations
  Execution Configuration Optimizations
  Control Flow

CUDA for Tegra:
  Tegra memory architecture
  dGPU 到 Tegra iGPU 的迁移差异
  EGL / graphics interop
```

## 6. 7 天临时补强计划

这个计划只用于恢复手感和形成面试材料，不和 GPU driver roadmap 抢主线。

### 第 1 天：恢复 CUDA 执行模型

动作：

```text
读 CUDA Programming Guide 的 programming model / SIMT kernel 部分。
跑 CUDA Samples 里的 vectorAdd、deviceQuery。
写一页笔记：grid、block、thread、warp、SM、occupancy。
```

产出：

```text
docs/graphics/cuda-execution-model-notes.md
```

### 第 2 天：访存和 profiling

动作：

```text
跑 transpose、reduction 或类似 sample。
用 Nsight Compute 看 global memory throughput、occupancy、warp divergence。
对比 coalesced 和 strided access。
```

产出：

```text
一张 profiler 截图
一页笔记：为什么访存模式比线程数更关键
```

### 第 3 天：实现一个小型 TopK baseline

动作：

```text
生成随机信号或模拟声纳能量数组。
CPU 写 reference TopK。
GPU 先用 Thrust / CUB 做 sort 或 TopK。
验证 value + index 是否一致。
```

产出：

```text
tools/cuda-topk-demo/
```

### 第 4 天：block local TopK 思路

动作：

```text
每个 block 处理一段输入，先产出局部 TopK。
第二阶段合并局部结果。
记录 K 很小时的性能变化。
```

产出：

```text
一份 naive / library / block-local 三种方案对比
```

### 第 5 天：Tegra / iGPU 视角

动作：

```text
读 CUDA for Tegra。
整理 dGPU 和 Tegra iGPU 在内存、copy、zero-copy、unified memory 上的区别。
```

产出：

```text
docs/graphics/tegra-cuda-memory-notes.md
```

### 第 6 天：把旧声纳项目写成技术复盘

动作：

```text
不需要找回全部代码。
先把 pipeline 画出来：
输入是什么
并行化哪一步
TopN/TopK 在哪里
CPU/GPU 如何同步
当时瓶颈可能在哪里
如果现在重做会如何 profile
```

产出：

```text
docs/graphics/sonar-cuda-retrospective.md
```

### 第 7 天：面试表述整理

动作：

```text
把项目压缩成 3 分钟讲述。
准备 10 个追问。
把 CUDA 经验连接到 GPU 驱动路线。
```

产出：

```text
一段项目介绍
一组面试问答
```

## 7. 面试里怎么讲这段经历

可以用这个结构：

```text
背景：
  声纳数据处理，部署在 Tegra X1 这类 embedded GPU 平台。

问题：
  输入数据量大，需要在有限功耗和延迟约束下做并行计算，并筛选 TopN 候选。

并行化：
  把样本级或窗口级计算映射到 CUDA thread/block。
  对候选结果做 reduction / selection / TopK。

性能关注：
  访存连续性、shared memory、warp divergence、CPU/GPU 同步、端到端延迟。

复盘：
  如果现在重做，会先用 Nsight Systems 看端到端 timeline，再用 Nsight Compute 看 kernel 内部瓶颈。
  TopK 会先用 CUB/Thrust 建 baseline，再根据 K 和数据分布决定是否写定制 kernel。

和驱动相关：
  这段经历让我理解 compute workload 对 GPU command submission、memory allocation、synchronization 和 profiling 的压力。
```

## 8. 高频追问

- Tegra X1 和普通桌面独显在内存架构上有什么不同？
- 为什么 CUDA kernel 的线程数不是越多越好？
- 什么是 warp divergence？
- 什么是 coalesced memory access？
- shared memory 为什么快？bank conflict 是什么？
- occupancy 高一定代表性能好吗？
- TopK 为什么不一定要全量 sort？
- K 很小和 K 很大时算法选择有什么不同？
- 如何验证 CUDA 优化没有改错结果？
- Nsight Systems 和 Nsight Compute 分别看什么？
- CUDA stream/event 和 Vulkan queue/fence/semaphore 怎么类比？
- CUDA runtime API 和 driver API 有什么区别？

## 9. 和 GPU 驱动 roadmap 的关系

这份补强应该插在 roadmap 的第 1 阶段之后：

```text
Vulkan / GL hook
-> CUDA + GPU architecture refresh
-> Mesa UMD
-> DRM / KMS / KMD
-> PCIe / DMA / IOMMU
-> GPU virtualization
```

它的目的不是偏离图形驱动方向，而是补上“GPU 本身如何执行并行 workload”的直觉。这个直觉会在 shader、compute、scheduler、memory management、profiling、虚拟化里反复出现。
