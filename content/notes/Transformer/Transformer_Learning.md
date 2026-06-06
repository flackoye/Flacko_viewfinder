---
title: Transformer 学习笔记
date: 2026-04-25
tags: [transformer, attention, NLP, GPT]
---
# Fun-Transformer
来自[datawahle的文档](https://github.com/datawhalechina/fun-transformer)
代码参考：**Attachment/demo_Transformer**

## 4.25 Fun-Transformer

今天从开头看到了transformer部分的2.6迁移学习

今天对于encoder-decoder这个架构有了一个比较深的从理解层面的体会，其实一切都是为了去预测，只有预测才能用于推理、用于迭代和验证。在encoder-context vector-decoder的过程中，encoder部分在一个一个token输入的时候，每一个token会改变当前的h向量，并且对于当前token的学习还会影响前面的token在h向量中的嵌入情况，就这样一直到最后一个隐藏层，即为context vector。后续的解码器会根据这个上下文向量进行预测输出。

教程里面也提到了，transformer本质上也是根据encoder-decoder架构的，只是摈弃了sqetosqe结构，而拥抱了自注意力机制，类似很多人来家里做客，他们说出自己的喜好之后，自注意力机制会将这些信息联系起来然后修改当前的向量。

后续希望可以从代码层面接触带transformer，今天的理解很可能是错误的，期待自己可以真正理解然后返回来勘误。

![](/notes/Transformer/images/image.png)



## 4.26 Fun-Transformer

今天看到了Task02的WordVec

QKV: 序列中包含  n  个Query向量，每个向量都需要执行这样的操作(Q与n个d维K向量点乘)，所以整个Self-Attention机制的总计算复杂度是 :
$$
O(n^2\cdot d)
$$
Gemini_quesition:
如果在 Transformer 中所有单词都是同时并行输入的（没有了 RNN 那种先来后到的顺序），那么模型是如何知道“我吃苹果”和“苹果吃我”这两句话在语序上的区别的？它使用了一个什么特殊机制来解决这个问题？
answer:
如果光靠self attention，transformer是无法区分的，因为‘我’和‘吃’就算交换顺序，他们互相作为Q和K的点乘是一样的，所以无法区分，而transformer是通过position embedding来区分的：
通过数学上的位置编码公式会给每一个token进行位置嵌入，进行嵌入之后，用来点乘的X就变成了词特征和位置特征的结合，因此可以区分这两句话
![](/notes/Transformer/images/image2.png)

通过增加i的数量，就是让每一个token的位置编码基于更高的维度，不同频率的正弦函数越多，每一个token就能通过更高维度去构建位置编码。
为什么基于sin/cos来呢：因为三角函数的值[-1,1]所以不用担心数值上的梯度爆炸，并且根据和差化积公式可以很方便地求出相对位置，然后词特征和位置编码的结合直接相加就好，如果进行拼接会造成维度爆炸



## 4.27 Fun-Transformer

今天学习了Word2Vec，上手了代码进行了实践，我直接透过PCA（主成分分析法）所展示的图像居然和高维余弦相似度分数的结果正好相反，因为PCA将20维的词向量压缩为了2维，很多信息都被压缩掉了，Gemini给了一个t-SNE的方法可以避免维度坍塌。

Word2Vec并没有使用位置编码，tokenization之后仍然是one-hot编码，然后（1*10000） * （10000* 20）-》1*20，其实就是一个所谓的查表让每一个token的词向量变成了一个随机输出20维向量，在这之后：
**反向传播和梯度下降**，让这个随机生成的20维向量变成该token的特征向量。

具体这个“学习”是怎么进行的，貌似后面两节就会讲。



## 4.28 Fun-Transformer

简单文本表示方法：

- 词袋模型：One-Hot
- TF-IDF 仍然是简单的方法，仅仅加入了词频的考量，但是词频和词的重要性不是对应的，所以IDF的作用就是：一个词如果在所有的文章里都出现，它的 IDF 权重就会趋近于 0，从而把这种“高频无用词”直接打压下去

神经网络：

- Word2Vec: 

  **CBOW**是根据上下文来预测中心词。例如，对于句子“我爱自然语言处理”，如果以“自然语言处理”为中心词，那么“我”和“爱”就是上下文。模型的目标是根据“我”和“爱”来预测“自然语言处理”。

  **Skip - Gram**则是相反，它是根据中心词来预测上下文。例如，根据“自然语言处理”来预测“我”和“爱”。

- GloVe:  考虑不同token直接的共现次数，可以一定程度上学习到语义和语法关系

接下来是4.27提到的词向量的构建：

重点步骤：

1. 预处理：文本清洗：类似代码中的将特殊字符/标签删除

   ​		分词：tokenization

2. 模型选择   GloVe：
   ![](/notes/Transformer/images/屏幕截图 2026-04-29 010134.png)

​	    有已知的参照，只需要根据公式进行优化即可，很美丽！

​	对Word2Vec的理解：

​	*情形：窗口['我', '爱', '学习', 'AI']，中心词‘我’，上下文词‘爱’*

​	基于滑动窗口大小，假设窗口取到的句子被分词为m个token，然后词向量维度定义为n，先随机生成输入权重矩阵（词向量表）m * n和输出权重矩阵n * m ，以Skip-Gram框架举例，提出中心词的词向量去乘输出矩阵**（此处运算得到的数字作为原始得分，这些得分因为是向量的乘积，所以代表这两个向量之间的夹角大小，也就是相似度大小，因此两个关系越紧密的token，他们的向量乘积应该越大，也就是夹角越小）**
​	然后对原始得分进行softmax处理，然后基于这个值进行**损失函数的计算**（因为选取了中心词其上下文词已知，所以进行了上下文词的预测）和**反向传播**，然后就是一个梯度的处理，如图：

![](/notes/Transformer/images/屏幕截图 2026-04-29 014200.png)

​	然后就是更新迭代咯，明白了吧哈哈哈，感觉第一次弄明白很多！



## 5.11 Fun-Transformer

- 每一个Encoder层都是由一个多头注意力机制和前馈层组成的

![](/notes/Transformer/images/image (1).png)

- ### Multi-Head Self-Attention

首先是对QVK的一个很具象很清晰的比喻：

![](/notes/Transformer/images/屏幕截图 2026-05-11 104422.png)

这里的三个权重矩阵就是用来计算对每一个token的注意力分配的工具，该矩阵的训练过程和Word2Vec中提到的训练方法类似，随机生成然后根据最后一层的结果进行损失计算和前向传播不断的优化矩阵。

实在是搞不懂，太空泛了还是，我先把对QVK的理解放一边

我现在明白了Attention(Q,V,K)计算出来的是每一个token融合其它token信息之后的向量组，先继续

多头其实就是把在这样一个计算工作做了多次，然后concat（拼接）



## 5.13 Fun-Transformer

decoder比encoder多一个掩码机制，就是因为对于decoder来说encoder的输入是一个一个token累积的，它会根据目前给出的句子加上encoder的k，v向量，预测出后面一个token，这其实就是掩码机制了，需要因果推理而不是一开始就告诉答案是什么。

掩码机制：
![](/notes/Transformer/images/屏幕截图 2026-05-14 011849.png)
掩码就是一个下三角为0，上三角是负无穷的矩阵，与原始得分矩阵做加法之后经过softmax处理，实现掩码的目的，可以掩盖住下一个token，让解码器进行预测。**这样还可以保证是并行处理的。**

因为解码器其实需要不断地向encoder发起访问，所以decoder除了自注意力机制还有交叉注意力层。

贪心搜索：每一次直接去概率最大的token
束搜索：每次保留 Top-K 个候选路径往后多看几步

BERT：时间是没有先后顺序的。它一次性把整句话吃进去，每个词都能同时看到它左边和右边的所有词。挖空然后根据上下文去预测，核心优势是NLU（自然语言理解）

GPT：核心优势是NLG（自然语言生成）只能看到过去和现在的次，完全根据上文进行预测，也是chatgpt这类聊天机器人的机理，即便是作为一个只有decoder的模型在训练的时候是将整个句子一起扔进去，然后通过掩码机制来实现预测的，而不是已知正确答案

> ***补充一点**：GPT抛弃了encoder和cross_attention，但是在decoder中依然保留了K和V，不过是结合掩码机制只根据自己和前文加权得来的V向量，也是一个自注意力的过程，但是只结合自己和前文的语义*。

理解K、V：
K就是该标签在特定维度下，在每个维度对应的取值，然后x乘以W_k就可以得到K向量
但是V就是代表该K标签下对应的内容的数值矩阵



## 5.19~5.21 

根据代码，学习了单层通用注意力中整个的训练流程，从前向传播到反向传播，最后再多层训练，感觉对于QKV的理解更深刻了一些，有一个重点就是**矩阵乘法的梯度**，因为整个反向传播的数学基础就是这个，从输出开始计算梯度，然后通过链式法则传到输入处，因此可以调整输入的矩阵或者说token的特征表示

还有一个重点知识就是前向传播中，注意力输出的一个公式理解：
**attn_out[i] = Σ attn_weights[i][j] * V[j]  每一个维度都是该token在融合上下文信息之后的该维度下的新表示，在每一个维度上每一个token*他们的注意力权重然后求和就是该token在该维度的新的值表示**



## 5.26 Fun-Transformer

Q/K/V 就是同一个输入的三种投影：

- **Q**：我在找什么（用来和别人匹配）
- **K**：我有什么（等别人来匹配）
- **V**：我的内容（匹配上之后给你拿走）

计算过程：Q 去和所有 K 算匹配度，匹配度高的 V 权重大，加权求和得到输出。

Q "找什么"不是人为设计的，是训练出来的——梯度从最终 Loss 一路传回来，调整 W_Q 和 W_K，让该关联的 token 匹配度高、不该关联的低。

自注意力时 Q=K=V 都是同一个句子，找内部关系；交叉注意力时 Q 来自一种语言，K/V 来自另一种语言，找跨语言的对应。

今天又回忆了一下qkv，还是感觉很难理解，不过结合一下梯度的思想和训练的思想就会好一点。

**Fun-Transfomer is end** 今天差不多结束了fun-Transformer的学习，这个文档其实写的很一般，但是就跟这个这个文档结合ai的代码，从理解和代码上理解了一下transformer是一个很基础的入门，就先把这些搞懂能明白，然后后期我们开始工程化的学习了。

# LLM_from_scratch
学习一个经典的项目[llm_from_scratch](https://github.com/rasbt/LLMs-from-scratch)
算是对于llm的底层拆解，带有详细的图片和代码
关于QKV的理解、反向传播的过程、矩形乘法的梯度计算我写在了**learning_record**

# ch04_main 
Implementing a GPT Model from Scratch
对于gpt2模型的底层拆解

## 5.27 llm_from_scratch ch04_01_main
今天非常艰难的看完了4.1coding一个llm的框架，也算是带着回顾了一下之前对于encoder-decoder的理解，更多是decoder，mask机制只用于attention部分对于特征向量计算过程中防止“偷看”，然后实际上在预测的时候就是用分数去乘词汇表，然后根据概率大小来预测下一个token，然后在训练的时候是每一个token都参与预测来更好得反向传播，但是在下游任务中就用最后一个token预测就可以。



## 5.28 llm_from_scratch ch04_01_main

今天学习涉及层归一化的内容，有一个比较重要的代码，是保证实现归一化后，均值为0，方差为1的：

`out_norm = (out - mean) / torch.sqrt(var)`

`print("Normalized layer outputs:\n", out_norm)`

`mean = out_norm.mean(dim=-1, keepdim=True)`

`var = out_norm.var(dim=-1, keepdim=True)`

`print("Mean:\n", mean)`

`print("Variance:\n", var)`

Normalized layer outputs: tensor([[ 0.6159,  1.4126, -0.8719,  0.5872, -0.8719, -0.8719],        [-0.0189,  0.1121, -1.0876,  1.5173,  0.5647, -1.0876]],       grad_fn=<DivBackward0>) 

Mean: tensor([[-5.9605e-08],        [ 1.9868e-08]], grad_fn=<MeanBackward1>)   **0**

Variance: tensor([[1.0000],        [1.0000]], grad_fn=<VarBackward0>)   **1**

但在真实的layernorm中，类定义如下：

`class LayerNorm(nn.Module):`

  `def __init__(self, emb_dim):`

​    `super().__init__()`

​    `self.eps = 1e-5`

​    `self.scale = nn.Parameter(torch.ones(emb_dim))`

​    `self.shift = nn.Parameter(torch.zeros(emb_dim))`

  `def forward(self, x):`

​    `mean = x.mean(dim=-1, keepdim=True)`

​    `var = x.var(dim=-1, keepdim=True, unbiased=False)`

​    `norm_x = (x - mean) / torch.sqrt(var + self.eps)`

​    `return self.scale * norm_x + self.shift`

引入了scale和shift的偏移，还避免方差为0时除数为0引发的错误引入了self.eps

`scale` 的初始值（乘以 1）和 `shift` 的初始值（加 0）在初始阶段不会产生任何影响；但它们是可训练参数，如果有助于提升模型在训练任务上的表现，LLM 会在训练过程中自动调整它们



## 5.29 llm_from_scratch ch04_01_main

激活函数在前馈层的中间：

在 FFN 的中间：

```
输入 x
  → Linear(d_model, 4*d_model)   # 先升维
  → GELU                          # 激活函数在这
  → Linear(4*d_model, d_model)    # 再降维回来
输出
```

两个 Linear 之间，只有这一个位置用 GELU。

第一个 Linear 负责把维度放大（比如从 768 → 3072），让网络有更大的空间去学习特征。但放大之后如果直接接下一个 Linear，就还是线性的，所以中间插一个 GELU 引入非线性。然后再降回原来的维度。

前馈网络就是对注意力机制中的输出进行升维->非线性变化->还原

非常清晰的gpt框架：

一个完整的 GPT 模型，从上到下：



```
输入 token ids: [1, 5, 3, 9]
       ↓
Token Embedding + Positional Embedding    ← 把 id 变成向量
       ↓
       ↓  × N 个 Transformer Block（GPT-2 小模型有 12 个）
  ┌─────────────────────────────┐
  │  LayerNorm                  │
  │  Multi-Head Attention       │  ← 你已经会的 Q/K/V 自注意力
  │  残差连接(Residual)          │
  │  LayerNorm                  │
  │  FFN: Linear→GELU→Linear    │  ← 刚学的
  │  残差连接(Residual)          │
  └─────────────────────────────┘
       ↓  × N
       ↓
  LayerNorm                         ← 最后一个
       ↓
  Linear(d_model, vocab_size)       ← 输出层，变成词表概率
       ↓
  输出: 每个位置对词表所有词的概率
```

**数据流动举个具体例子**（GPT-2 小模型）：



```
"我 爱 你" 三个字
       ↓
Embedding: 每个字变成 768 维向量
  形状: [3, 768]
       ↓
  × 12 个 Block:
    注意力: [3, 768] → [3, 768]     （3个位置互相看）
    FFN:    [3, 768] → [3, 3072] → [3, 768]
       ↓
  输出层: [3, 768] → [3, 50257]    （50257 是词表大小）
       ↓
  每个位置都得到一个 50257 维的概率分布
  拿最后一个位置的预测，选概率最高的词，就是生成的下一个词
```

残差连接就是把该层的输入和输出加起来，避免梯度消失



## 5.30 llm_from_scratch ch04_01_main

今天看完了ch04里面主要的部分，算是通过代码和一些模型流程图打通了gpt的构建过程，收获还是很多的，今天看的两部分没有什么需要记录的。

# ch04_kv_cache
内容是kv缓存机制的代码，是一种在模型预测是采用的提高计算效率的技术

## 6.1 llm_from_scratch ch04_03_kvCache

今天看了gpt和gpt_with_kv_cache的对比的readme，这个kv缓存主要是防止在注意力计算的过程中对于前n-1个token进行多次的K、V矩阵计算，导致积累的计算量呈二次方增长，因此可以提高计算效率，但是同时会带来更多的内存消耗。

今天会把gpt_ch04和gpt_with_kv_cache对比看下来。



## 6.3 llm_from_scratch ch04_03_kvCache

一个小点：

![](/notes/Transformer/images/image-20260603093149009.png)

注意力计算完成之后，会将多头的结果进行拼接：

   `# Combine heads, where self.d_out = self.num_heads * self.head_dim`

​    `context_vec = context_vec.contiguous().view(b, num_tokens, self.d_out)`

​    `context_vec = self.out_proj(context_vec)  # optional projection`

**`view` 把多个头的输出拼接 → `out_proj` 做线性混合 → 得到最终的多头注意力输出**

![](/notes/Transformer/images/image-20260603160341620.png)

这个W_out是做nn.Linear线性变化时自动创建的，就是这个过程中存在的权值矩阵，多头场景下，这个矩阵大小是全局大小，然后将多头线性拼接起来之后，去@这个W_out矩阵就是在让头之间交流信息。









