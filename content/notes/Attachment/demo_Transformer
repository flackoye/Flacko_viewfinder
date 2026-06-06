"""
================================================================================
    Transformer 中文→英文 翻译模型（学习版）
================================================================================

    你已经用 NumPy 实现了单层注意力，理解了 Q/K/V、softmax、mask、反向传播的数学原理。
    这份代码的目标是：在那些知识的基础上，搭建一个【完整的 Transformer】。

    和 NumPy 版本的区别：
    ┌──────────────┬──────────────────┬──────────────────────┐
    │              │  NumPy 版本      │  本代码（PyTorch）    │
    ├──────────────┼──────────────────┼──────────────────────┤
    │ 框架         │ 手动算梯度       │ PyTorch 自动求导      │
    │ 模型结构     │ 单层注意力       │ 完整 Transformer      │
    │ 任务         │ 预测 "hello"     │ 中→英 翻译            │
    │ 多头注意力   │ 无（单头）       │ 8 头并行              │
    │ 位置编码     │ 无               │ 正弦位置编码          │
    │ 残差+归一化  │ 无               │ 每个子层都有          │
    │ Encoder      │ 无               │ 6 层 Encoder          │
    │ Decoder      │ 无               │ 6 层 Decoder          │
    └──────────────┴──────────────────┴──────────────────────┘

    阅读顺序（按文件中的标注）：
        第一站 → 数据准备：理解输入输出长什么样
        第二站 → 模型参数：理解超参数的含义
        第三站 → 位置编码：为什么需要位置信息
        第四站 → Mask 机制：两种 mask 各管什么
        第五站 → 注意力计算：从单头到多头
        第六站 → 前馈网络：注意力之后的处理
        第七站 → Encoder/Decoder 层：组装子模块
        第八站 → 完整 Transformer：拼接 Encoder + Decoder
        第九站 → 训练和测试：跑起来看看
================================================================================
"""

import math
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
import torch.utils.data as Data

# 固定随机种子，保证每次运行结果一致（方便对比实验）
torch.manual_seed(42)
np.random.seed(42)

# ============================================================
#  第一站：准备训练数据
# ============================================================
#
#  任务：中文翻译成英文
#  例如："我 是 学 生" → "I am a student"
#
#  Transformer 是序列到序列模型（Seq2Seq），所以数据分两部分：
#    - Encoder 输入：源语言（中文）
#    - Decoder 输入：目标语言（英文），训练时是"正确答案左移一位"
#    - Decoder 输出：目标语言（英文），逐词预测
#
#  你可能好奇：为什么 Decoder 的输入和输出不一样？
#  ┌─────────────────────────────────────────────────────────────┐
#  │  因为训练时我们用"老师强制"（Teacher Forcing）策略：          │
#  │  给 Decoder 看 "S I am a student"（S=开始符号）             │
#  │  让它预测       "I am a student E"（E=结束符号）            │
#  │  每个位置都是：看了前面的词，预测下一个词                     │
#  │  就像你 NumPy 版本里 "hell" → "ello" 的思路完全一样！       │
#  └─────────────────────────────────────────────────────────────┘

# --------------------------------------------------
#  训练集：模型通过这些数据学习翻译规律
# --------------------------------------------------
#  ┌─────────────────────────────────────────────────────────────────┐
#  │  关键设计原则：                                                  │
#  │  1. 每个中文字都要在训练中【和它的英文翻译一起出现】多次           │
#  │     例如："女" 必须和 "girl" 一起出现，模型才能学到对应关系       │
#  │  2. 同一个字要在【不同的句子/位置】出现，这样模型才能             │
#  │     学到"不管在哪，这个字都翻译成那个词"的规律                    │
#  │  3. 训练集要覆盖所有词汇，否则模型没见过的字就翻译不了            │
#  └─────────────────────────────────────────────────────────────────┘
#
#  下面有 10 种不同的句子，每种重复 3 次（共 30 条训练数据）。
#  重复是为了让模型多看几遍，加深印象（就像你做练习册会反复做题一样）。

# 10 种不同的训练句子
_train_unique = [
    # Pattern A："我 是 X Y" → "I am a XY"（这些英文刚好 5 个 token，不需要 P）
    ['我 是 学 生 P',   'S I am a student',    'I am a student E'],     # 学→student
    ['我 是 男 生 P',   'S I am a boy',         'I am a boy E'],         # 男→boy
    ['我 是 女 生 P',   'S I am a girl',         'I am a girl E'],         # 女→girl
    ['我 是 老 师 P',   'S I am a teacher',     'I am a teacher E'],     # 老/师→teacher

    # Pattern B："我 喜 欢 X" → "I like X"（英文 4 个词 + P 补齐 = 5）
    ['我 喜 欢 猫 P',   'S I like cat P',       'I like cat P E'],       # 猫→cat
    ['我 喜 欢 狗 P',   'S I like dog P',       'I like dog P E'],       # 狗→dog

    # Pattern C："X Y 喜 欢 Z" → "XY like Z"（不同主语，让每个词在不同位置出现）
    ['男 生 喜 欢 猫',  'S boy like cat P',      'boy like cat P E'],     # 男/生 在主语位置
    ['女 生 喜 欢 狗',  'S girl like dog P',     'girl like dog P E'],    # 女/生 在主语位置
    ['老 师 喜 欢 猫',  'S teacher like cat P',  'teacher like cat P E'], # 老/师 在主语位置
    ['学 生 喜 欢 狗',  'S student like dog P',  'student like dog P E'], # 学/生 在主语位置
]

# 每种句子重复 3 次，让模型多看几遍
train_sentences = _train_unique * 3

# --------------------------------------------------
#  测试集：模型【没见过】这些完整句子，用来检验是否真正学会了
# --------------------------------------------------
#  ┌─────────────────────────────────────────────────────────────────┐
#  │  测试集的设计思路：                                              │
#  │  - 每个字都在训练集中出现过（否则模型不可能认识）               │
#  │  - 但【整体组合】在训练集中从未出现过                           │
#  │  - 如果模型只是死记硬背训练句子，测试集就会翻译错               │
#  │  - 如果模型学会了字→词的对应规律，就应该能正确翻译               │
#  │                                                                 │
#  │  例如："女 生 喜 欢 猫" 这句话模型没见过                       │
#  │  但训练中有：                                                   │
#  │    - "女 生" → "girl"（在 "我 是 女 生" 和 "女 生 喜 欢 狗" 中）│
#  │    - "猫" → "cat"（在多个句子中出现过）                        │
#  │    - "喜 欢" → "like"（在多个句子中出现过）                    │
#  │  如果模型学会了这些对应关系，就能组合出正确翻译                  │
#  └─────────────────────────────────────────────────────────────────┘

test_sentences = [
    ['女 生 喜 欢 猫',  'S girl like cat P',    'girl like cat P E'],
    ['学 生 喜 欢 猫',  'S student like cat P', 'student like cat P E'],
    ['老 师 喜 欢 狗',  'S teacher like dog P', 'teacher like dog P E'],
]

#  注意：
#  - P 是占位符（Padding），因为句子长度不一样，短的用 P 补齐到固定长度
#  - S 是开始符号（Start），告诉 Decoder "从这里开始翻译"
#  - E 是结束符号（End），告诉 Decoder "翻译到这里结束"

# --------------------------------------------------
#  构建词汇表：把每个字/词映射到一个整数索引
# --------------------------------------------------
#  就像你 NumPy 版本里的 char_to_idx，只不过这里中英文各一个词汇表
#  词汇表要包含训练集和测试集中【所有】出现的字/词

# 中文词汇表（Encoder 用）
src_vocab = {'P': 0, '我': 1, '是': 2, '学': 3, '生': 4, '喜': 5, '欢': 6, '男': 7, '女': 8, '老': 9, '师': 10, '猫': 11, '狗': 12}
src_idx2word = {idx: char for char, idx in src_vocab.items()}
src_vocab_size = len(src_vocab)  # 13

# 英文词汇表（Decoder 用）
tgt_vocab = {'S': 0, 'E': 1, 'P': 2, 'I': 3, 'am': 4, 'a': 5, 'student': 6, 'like': 7, 'boy': 8, 'girl': 9, 'teacher': 10, 'cat': 11, 'dog': 12}
tgt_idx2word = {idx: word for word, idx in tgt_vocab.items()}
tgt_vocab_size = len(tgt_vocab)  # 13

# 句子固定长度（所有句子补齐到这个长度）
src_len = 5  # 中文句子最大长度："我 是 学 生 P" = 5 个字
tgt_len = 5  # 英文句子最大长度："S I am a student" = 5 个词

# --------------------------------------------------
#  把句子转换成索引张量
# --------------------------------------------------
def make_data(sentences):
    """
    把文本句子转成数字索引，PyTorch 模型只能处理数字。

    返回：
        enc_inputs:  [batch, src_len]  中文索引
        dec_inputs:  [batch, tgt_len]  英文输入索引（带 S 开头）
        dec_outputs: [batch, tgt_len]  英文目标索引（带 E 结尾）
    """
    enc_inputs, dec_inputs, dec_outputs = [], [], []
    for i in range(len(sentences)):
        # 例如 "我 是 学 生 P" → [1, 2, 3, 4, 0]
        enc_input = [src_vocab[word] for word in sentences[i][0].split()]
        # 例如 "S I am a student" → [0, 3, 4, 5, 6]
        dec_input = [tgt_vocab[word] for word in sentences[i][1].split()]
        # 例如 "I am a student E" → [3, 4, 5, 6, 1]
        dec_output = [tgt_vocab[word] for word in sentences[i][2].split()]

        enc_inputs.append(enc_input)
        dec_inputs.append(dec_input)
        dec_outputs.append(dec_output)

    return torch.LongTensor(enc_inputs), torch.LongTensor(dec_inputs), torch.LongTensor(dec_outputs)


# 用训练集数据构建训练 DataLoader
train_enc, train_dec_in, train_dec_out = make_data(train_sentences)

print("=" * 60)
print("训练集准备完成")
print("=" * 60)
print(f"训练集 enc_inputs (中文): \n{train_enc}")
print(f"训练集 dec_inputs (英文输入): \n{train_dec_in}")
print(f"训练集 dec_outputs (英文目标): \n{train_dec_out}")
print()

# 用测试集数据构建测试 DataLoader
test_enc, test_dec_in, test_dec_out = make_data(test_sentences)
print(f"测试集 enc_inputs (中文): \n{test_enc}")
print(f"（测试集的英文翻译不会给模型看，只用来验证结果）")
print()

# --------------------------------------------------
#  构建 DataLoader：按批次送数据
# --------------------------------------------------
#  为什么需要 batch？
#  现实中训练数据可能有几万条，不可能一次全塞进 GPU。
#  DataLoader 每次取一小批（比如 2 条），分批训练。


class MyDataSet(Data.Dataset):
    """自定义数据集，PyTorch 规定的格式"""
    def __init__(self, enc_inputs, dec_inputs, dec_outputs):
        super(MyDataSet, self).__init__()
        self.enc_inputs = enc_inputs
        self.dec_inputs = dec_inputs
        self.dec_outputs = dec_outputs

    def __len__(self):
        return self.enc_inputs.shape[0]

    def __getitem__(self, idx):
        return self.enc_inputs[idx], self.dec_inputs[idx], self.dec_outputs[idx]


# batch_size=2：每次取 2 条数据训练
# 训练集 6 条数据 → 每批 2 条，共 3 批
train_loader = Data.DataLoader(MyDataSet(train_enc, train_dec_in, train_dec_out), batch_size=2, shuffle=False)
# 测试集 2 条数据，不做训练，只在最后验证翻译结果
test_loader = Data.DataLoader(MyDataSet(test_enc, test_dec_in, test_dec_out), batch_size=2, shuffle=False)


# ============================================================
#  第二站：模型超参数
# ============================================================
#
#  这些数字控制模型的"大小"和"能力"。你可以理解为：
#
#  d_model  → 每个词用多长的向量表示（越大越能编码更多信息）
#  d_ff     → 前馈网络隐藏层大小（类似"思考的深度"）
#  d_k, d_v → 每个注意力头中 Q/K/V 的维度
#  n_layers → Encoder/Decoder 各堆叠几层（越深越能提取复杂特征）
#  n_heads  → 多头注意力的头数（不同头关注不同的信息）

d_model = 512    # 词向量维度（论文推荐 512）
d_ff = 2048      # 前馈网络隐藏层维度
d_k = d_v = 64   # 每个头的 Q/K/V 维度
n_layers = 6     # Encoder 和 Decoder 的层数
n_heads = 8      # 多头注意力的头数

# 一个关键的关系：d_k × n_heads = 64 × 8 = 512 = d_model
# 这不是巧合！多头注意力的设计就是：把 d_model 拆成 n_heads 份，
# 每份 d_k 维度，分别计算注意力，最后拼接回来还是 d_model 维度。


# ============================================================
#  第三站：位置编码（Positional Encoding）
# ============================================================
#
#  【为什么需要位置编码？】
#
#  注意力机制本身是"位置无关"的——它只看词和词之间的关系，
#  不关心词在句子中的位置。也就是说：
#    "我 打 你" 和 "你 打 我"
#  对于注意力来说是一样的（都是三个词两两计算相似度）。
#
#  但这两个句子意思完全不同！所以我们需要告诉模型每个词的位置。
#  方法：给每个词向量加上一个"位置向量"，让它携带位置信息。
#
#  【怎么算？】
#  用正弦和余弦函数：
#    偶数维度：PE(pos, 2i)   = sin(pos / 10000^(2i/d_model))
#    奇数维度：PE(pos, 2i+1) = cos(pos / 10000^(2i/d_model))
#
#  其中 pos 是词在句子中的位置（0, 1, 2, ...），i 是维度索引。
#  不同位置、不同维度有不同的频率，模型可以从这些三角函数中推断位置。

class PositionalEncoding(nn.Module):
    def __init__(self, d_model, dropout=0.1, max_len=5000):
        super(PositionalEncoding, self).__init__()
        self.dropout = nn.Dropout(p=dropout)

        # 先算出 pos / 10000^(2i/d_model) 这部分
        # pos_table 形状：(max_len, d_model)
        pos_table = np.array([
            [pos / np.power(10000, 2 * i / d_model) for i in range(d_model)] #保证了位置编码向量的维度和词嵌入的一致
            if pos != 0 else np.zeros(d_model)
            for pos in range(max_len)
        ])

        # 偶数维度用 sin，奇数维度用 cos
        pos_table[1:, 0::2] = np.sin(pos_table[1:, 0::2])  # 0::2 表示从第0列开始每隔1列取
        pos_table[1:, 1::2] = np.cos(pos_table[1:, 1::2])  # 1::2 表示从第1列开始每隔1列取

        # 转成 PyTorch 张量，不参与梯度计算（位置编码是固定的，不需要学习）
        self.pos_table = torch.FloatTensor(pos_table)

    def forward(self, enc_inputs):
        """
        enc_inputs: (seq_len, batch_size, d_model)  词嵌入后的张量
        返回：词嵌入 + 位置编码，然后做 Dropout（随机丢弃一些值，防止过拟合）
        """
        # enc_inputs.size(1) 是 seq_len，取前 seq_len 行位置编码
        enc_inputs += self.pos_table[:enc_inputs.size(1), :]
        return self.dropout(enc_inputs)


# ============================================================
#  第四站：Mask 机制
# ============================================================
#
#  Transformer 里有两种 mask，作用完全不同：
#
#  【1. Pad Mask（填充遮盖）】
#  句子长度不一样时用 P 补齐，但 P 没有实际意义，不应该参与注意力计算。
#  Pad Mask 的作用：把 P 位置的注意力分数设为 -inf，softmax 后变成 0。
#  → 和你 NumPy 版本里用 -1e9 遮盖的思路一样！
#
#  【2. Subsequence Mask（因果遮盖/上三角 mask）】
#  Decoder 在预测第 t 个词时，不能看到第 t+1, t+2, ... 的词（那是"未来"）。
#  → 这就是你 NumPy 版本里的下三角 mask！
#  → 这里用上三角矩阵（对角线以上为 1），1 表示要遮盖的位置。
#
#  ┌─────────────────────────────────────────────────────────────┐
#  │  注意：你的 NumPy 版本里 mask=0 表示遮盖，                    │
#  │  这份代码里 mask=True（或 1）表示遮盖。                       │
#  │  不同代码的约定可能不同，看清楚哪个值代表"遮盖"。              │
#  └─────────────────────────────────────────────────────────────┘

def get_attn_pad_mask(seq_q, seq_k):
    """
    生成 Pad Mask：遮盖句子中的填充符号 P（索引为 0）

    用在哪：
        - Encoder 自注意力：遮盖中文句子中的 P
        - Decoder 自注意力：遮盖英文句子中的 S（索引也是 0）
        - Encoder-Decoder 注意力：遮盖中文句子中的 P

    参数：
        seq_q: [batch_size, len_q]  查询序列（决定输出长度）
        seq_k: [batch_size, len_k]  键序列（决定哪些位置要 mask）

    返回：
        [batch_size, len_q, len_k]  True=要遮盖，False=不遮盖

    为什么需要 seq_q 和 seq_k 两个参数？
        因为 Encoder-Decoder 注意力中，Q 来自 Decoder，K 来自 Encoder，
        两者的长度可能不一样（中文 5 个字，英文 5 个词，但内容不同）。
        每个 Q 位置都要"看"所有 K 位置，所以 mask 要扩展到 (len_q, len_k)。
    """
    batch_size, len_q = seq_q.size()
    batch_size, len_k = seq_k.size()

    # seq_k 中等于 0 的位置就是 P（填充），标记为 True
    pad_attn_mask = seq_k.data.eq(0)            # [batch_size, len_k]
    pad_attn_mask = pad_attn_mask.unsqueeze(1)   # [batch_size, 1, len_k]  增加一个维度
    pad_attn_mask = pad_attn_mask.expand(batch_size, len_q, len_k)  # [batch_size, len_q, len_k]
    # expand 的作用：把 [batch, 1, len_k] 复制 len_q 份变成 [batch, len_q, len_k]
    # 因为每个 Q 位置面对的 K 的 mask 是一样的

    return pad_attn_mask


def get_attn_subsequence_mask(seq):
    """
    生成因果 Mask（上三角矩阵）：Decoder 不能看到未来的词

    只在 Decoder 自注意力中使用。

    参数：
        seq: [batch_size, tgt_len]  Decoder 输入序列

    返回：
        [batch_size, tgt_len, tgt_len]  上三角为 1（遮盖），下三角为 0（不遮盖）

    例如 tgt_len=5 时的单条数据：
        [[0, 1, 1, 1, 1],   ← 第 0 个位置只能看自己
         [0, 0, 1, 1, 1],   ← 第 1 个位置能看第 0、1 个
         [0, 0, 0, 1, 1],   ← 以此类推
         [0, 0, 0, 0, 1],
         [0, 0, 0, 0, 0]]

    np.triu(..., k=1) 表示"从主对角线往上一格开始，取上三角"
    k=0 会包含对角线，k=1 不包含对角线（当前位置不遮盖自己）
    """
    attn_shape = [seq.size(0), seq.size(1), seq.size(1)]
    subsequence_mask = np.triu(np.ones(attn_shape), k=1)
    subsequence_mask = torch.from_numpy(subsequence_mask).byte()
    return subsequence_mask


# ============================================================
#  第五站：注意力计算
# ============================================================
#
#  这部分你已经很熟悉了！核心公式：
#    Attention(Q, K, V) = softmax(Q @ K.T / √d_k) @ V
#
#  和你 NumPy 版本的区别：
#    1. 多了一个 batch 维度（同时处理多条数据）
#    2. 多了一个 heads 维度（多头注意力）
#    3. mask 用 PyTorch 的 masked_fill_ 函数代替了 np.where
#
#  张量形状变化：
#    Q: [batch, n_heads, len_q, d_k]
#    K: [batch, n_heads, len_k, d_k]
#    V: [batch, n_heads, len_v, d_v]   ← 注意！d_v 可以和 d_k 不一样
#
#    scores = Q @ K.T → [batch, n_heads, len_q, len_k]
#    attn   = softmax(scores) → [batch, n_heads, len_q, len_k]
#    output = attn @ V → [batch, n_heads, len_q, d_v]
#
#  其中 len_k 一定等于 len_v（因为 K 和 V 来自同一个输入序列）。

class ScaledDotProductAttention(nn.Module):
    """缩放点积注意力——你已经会了的核心计算"""

    def __init__(self):
        super(ScaledDotProductAttention, self).__init__()

    def forward(self, Q, K, V, attn_mask):
        """
        Q: [batch, n_heads, len_q, d_k]
        K: [batch, n_heads, len_k, d_k]
        V: [batch, n_heads, len_v, d_v]
        attn_mask: [batch, n_heads, len_q, len_k]  True=要遮盖的位置

        返回：
            context: [batch, n_heads, len_q, d_v]  注意力输出
            attn:    [batch, n_heads, len_q, len_k] 注意力权重（可视化用）
        """
        # 1. 计算注意力分数
        scores = torch.matmul(Q, K.transpose(-1, -2)) / np.sqrt(d_k)
        # K.transpose(-1, -2) 交换最后两个维度，相当于转置 K
        # 除以 √d_k 是为了防止点积值太大导致 softmax 梯度消失（你 NumPy 版本里也做了）

        # 2. 应用 mask
        scores.masked_fill_(attn_mask, -1e9)
        # masked_fill_ 是 PyTorch 的原地操作：mask 为 True 的位置填 -1e9
        # 等价于你 NumPy 版本的 np.where(mask == 0, -1e9, scores)

        # 3. softmax 得到注意力权重
        attn = nn.Softmax(dim=-1)(scores)  # 在最后一个维度（len_k）上做 softmax

        # 4. 加权求和
        context = torch.matmul(attn, V)
        # 和你 NumPy 版本的 attn_weights @ V 完全一样

        return context, attn


# --------------------------------------------------
#  多头注意力（Multi-Head Attention）
# --------------------------------------------------
#
#  【为什么要多头？】
#
#  单头注意力只能学一种"关注模式"。但语言中有多种关系：
#    - 语法关系（主语关注动词）
#    - 语义关系（"学生"关注"学习"）
#    - 指代关系（"他"关注前面提到的人）
#
#  多头注意力让不同的头学习不同的关注模式，最后拼接起来。
#  就像一个团队里 8 个人各看各的角度，最后汇总意见。
#
#  【怎么做？】
#  1. 把输入分别投影到 Q、K、V（和单头一样）
#  2. 按头数拆分：把 d_model=512 拆成 n_heads=8 份，每份 d_k=64
#  3. 每个头独立计算注意力
#  4. 拼接所有头的输出，再过一个线性层融合
#
#  形状变化（重点看 view 和 transpose 的作用）：
#    输入: [batch, seq_len, d_model=512]
#    投影: W_Q(input) → [batch, seq_len, n_heads*d_k = 512]
#    拆分: view(batch, seq_len, n_heads, d_k) → [batch, seq_len, 8, 64]
#    换位: transpose(1,2) → [batch, 8, seq_len, 64]
#    现在每个头可以独立计算注意力了！

class MultiHeadAttention(nn.Module):
    def __init__(self):
        super(MultiHeadAttention, self).__init__()

        # 三个线性变换：输入 → Q / K / V
        # nn.Linear(d_model, d_k * n_heads) 把 d_model 维映射到 n_heads 个头的维度
        self.W_Q = nn.Linear(d_model, d_k * n_heads, bias=False)
        self.W_K = nn.Linear(d_model, d_k * n_heads, bias=False)
        self.W_V = nn.Linear(d_model, d_v * n_heads, bias=False)

        # 输出线性层：把多头拼接的结果映射回 d_model
        self.fc = nn.Linear(n_heads * d_v, d_model, bias=False)

    def forward(self, input_Q, input_K, input_V, attn_mask):
        """
        这个函数被三种不同的场景调用：
        ┌──────────────────────┬──────────────────┬──────────────────┬──────────────────┐
        │ 场景                 │ input_Q          │ input_K          │ input_V          │
        ├──────────────────────┼──────────────────┼──────────────────┼──────────────────┤
        │ Encoder 自注意力     │ 中文嵌入         │ 中文嵌入         │ 中文嵌入         │
        │ Decoder 自注意力     │ 英文嵌入         │ 英文嵌入         │ 英文嵌入         │
        │ Encoder-Decoder 注意 │ 英文嵌入(Q来源)  │ 中文编码(K来源)  │ 中文编码(V来源)  │
        └──────────────────────┴──────────────────┴──────────────────┴──────────────────┘

        前两种：Q=K=V，同一个输入（自注意力）
        第三种：Q 和 K/V 来自不同地方（交叉注意力）
        """
        residual, batch_size = input_Q, input_Q.size(0)
        # residual 保存输入，后面做残差连接用（output = output + residual）

        # 1. 线性投影 + 拆分成多头
        Q = self.W_Q(input_Q).view(batch_size, -1, n_heads, d_k).transpose(1, 2)
        K = self.W_K(input_K).view(batch_size, -1, n_heads, d_k).transpose(1, 2)
        V = self.W_V(input_V).view(batch_size, -1, n_heads, d_v).transpose(1, 2)
        # view(batch, -1, n_heads, d_k) 中 -1 表示自动计算 seq_len
        # transpose(1, 2) 把 n_heads 维度放到前面，方便每个头独立计算

        # 2. mask 也要扩展到多头
        # 原始 mask: [batch, len_q, len_k]
        # 扩展后:    [batch, n_heads, len_q, len_k]
        attn_mask = attn_mask.unsqueeze(1).repeat(1, n_heads, 1, 1)

        # 3. 调用缩放点积注意力（就是上面那个类）
        context, attn = ScaledDotProductAttention()(Q, K, V, attn_mask)

        # 4. 拼接多头的结果
        context = context.transpose(1, 2).reshape(batch_size, -1, n_heads * d_v)
        # transpose(1,2) 把 n_heads 放回 seq_len 后面
        # reshape 把最后两个维度合并：n_heads × d_v → n_heads * d_v = d_model

        # 5. 通过线性层融合多头信息
        output = self.fc(context)  # [batch, seq_len, d_model]

        # 6. 残差连接 + 层归一化
        # ┌─────────────────────────────────────────────────────────────┐
        # │  残差连接：output = output + residual                        │
        # │  作用：让梯度可以直接跳过这一层传回去，防止深层网络梯度消失    │
        # │  没有残差连接的话，6 层网络的梯度会逐层衰减，后面的层几乎学不到 │
        # │                                                             │
        # │  层归一化（LayerNorm）：对每个样本的特征维度做归一化          │
        # │  作用：稳定训练过程，让每层的输出分布保持稳定                 │
        # └─────────────────────────────────────────────────────────────┘
        return nn.LayerNorm(d_model)(output + residual), attn


# ============================================================
#  第六站：前馈网络（Feed-Forward Network）
# ============================================================
#
#  每个注意力层之后都有一个 FFN，结构很简单：
#    Linear(d_model → d_ff) → ReLU → Linear(d_ff → d_model)
#
#  也就是：512 → 2048 → 512
#
#  【为什么中间要变大再变小？】
#  相当于"展开思考再压缩结论"。中间维度更大，让模型有更多空间提取特征。
#  就像人思考问题时脑子里会展开很多想法，最后输出一个简洁的结论。

class FF(nn.Module):
    def __init__(self):
        super(FF, self).__init__()
        self.fc = nn.Sequential(
            nn.Linear(d_model, d_ff, bias=False),   # 512 → 2048（展开）
            nn.ReLU(),                               # 激活函数，引入非线性
            nn.Linear(d_ff, d_model, bias=False),    # 2048 → 512（压缩）
        )

    def forward(self, inputs):
        residual = inputs
        output = self.fc(inputs)
        # 同样有残差连接 + 层归一化
        return nn.LayerNorm(d_model)(output + residual)


# ============================================================
#  第七站：Encoder 层 和 Decoder 层
# ============================================================
#
#  现在把上面的模块组装起来。
#
#  ┌────────────────────────────────────────────────────────────┐
#  │  Encoder 层的结构（从左到右数据流动）：                      │
#  │                                                            │
#  │    输入 → 多头自注意力 → Add & Norm → 前馈网络 → Add & Norm → 输出 │
#  │           (Q=K=V=输入)                                     │
#  │                                                            │
#  │  Decoder 层的结构（多了一个交叉注意力）：                    │
#  │                                                            │
#  │    输入 → 多头自注意力 → Add & Norm                         │
#  │           (Q=K=V=输入)                                     │
#  │         → 交叉注意力 → Add & Norm → 前馈网络 → Add & Norm → 输出 │
#  │           (Q=Decoder输入, K=V=Encoder输出)                  │
#  └────────────────────────────────────────────────────────────┘

class EncoderLayer(nn.Module):
    """单个 Encoder 层：自注意力 + 前馈网络"""
    def __init__(self):
        super(EncoderLayer, self).__init__()
        self.enc_self_attn = MultiHeadAttention()  # 自注意力（Q=K=V=自己）
        self.pos_ffn = FF()                         # 前馈网络

    def forward(self, enc_inputs, enc_self_attn_mask):
        """
        enc_inputs:          [batch, src_len, d_model]  词嵌入+位置编码后的输入
        enc_self_attn_mask:  [batch, src_len, src_len]  Pad Mask

        注意这里 MultiHeadAttention 传入了三次相同的 enc_inputs：
        Q=K=V=enc_inputs，这就是"自注意力"——自己和自己算注意力。
        """
        enc_outputs, attn = self.enc_self_attn(
            enc_inputs, enc_inputs, enc_inputs, enc_self_attn_mask
        )
        enc_outputs = self.pos_ffn(enc_outputs)
        return enc_outputs, attn


class DecoderLayer(nn.Module):
    """单个 Decoder 层：自注意力 + 交叉注意力 + 前馈网络"""
    def __init__(self):
        super(DecoderLayer, self).__init__()
        self.dec_self_attn = MultiHeadAttention()   # 自注意力（Q=K=V=Decoder输入）
        self.dec_enc_attn = MultiHeadAttention()     # 交叉注意力（Q=Decoder, K=V=Encoder）
        self.pos_ffn = FF()

    def forward(self, dec_inputs, enc_outputs, dec_self_attn_mask, dec_enc_attn_mask):
        """
        dec_inputs:          [batch, tgt_len, d_model]  Decoder 的输入
        enc_outputs:         [batch, src_len, d_model]  Encoder 的输出（K, V 来源）
        dec_self_attn_mask:  [batch, tgt_len, tgt_len]  Pad Mask + 因果 Mask
        dec_enc_attn_mask:   [batch, tgt_len, src_len]  Encoder 的 Pad Mask

        ┌─────────────────────────────────────────────────────────────┐
        │  第一次注意力（自注意力）：                                   │
        │    Q = K = V = dec_inputs                                   │
        │    Decoder 自己看自己，但不能看未来（有因果 mask）            │
        │                                                             │
        │  第二次注意力（交叉注意力）：这是 Decoder 最关键的部分！      │
        │    Q = dec_outputs（第一次注意力的输出）                      │
        │    K = V = enc_outputs（Encoder 的输出）                     │
        │    Decoder 在生成英文时，"回看"中文原文，找到对应关系         │
        │    例如：要翻译"学"时，Q 携带了"当前要翻译的位置"的信息，     │
        │    K/V 携带了"中文每个字的信息"，注意力就能找到对应的中文字    │
        └─────────────────────────────────────────────────────────────┘
        """
        # 第一次注意力：Decoder 自注意力（有因果 mask）
        dec_outputs, dec_self_attn = self.dec_self_attn(
            dec_inputs, dec_inputs, dec_inputs, dec_self_attn_mask
        )

        # 第二次注意力：Encoder-Decoder 交叉注意力
        dec_outputs, dec_enc_attn = self.dec_enc_attn(
            dec_outputs, enc_outputs, enc_outputs, dec_enc_attn_mask
        )

        # 前馈网络
        dec_outputs = self.pos_ffn(dec_outputs)
        return dec_outputs, dec_self_attn, dec_enc_attn


# ============================================================
#  第八站：完整的 Encoder 和 Decoder
# ============================================================

class Encoder(nn.Module):
    """
    完整的 Encoder：把 N 个 Encoder 层叠在一起。

    数据流：
      中文索引 → Embedding（词嵌入）→ 加位置编码 → 通过 6 个 Encoder 层

    Embedding 的作用：把整数索引变成 d_model 维的浮点向量。
      例如："学" 的索引是 3，经过 Embedding 变成 [0.12, -0.34, 0.56, ...]（512 维）
      这个向量是可学习的，训练过程中会不断调整，让意思相近的词向量也相近。
    """
    def __init__(self):
        super(Encoder, self).__init__()
        self.src_emb = nn.Embedding(src_vocab_size, d_model)      # 词嵌入
        self.pos_emb = PositionalEncoding(d_model)                 # 位置编码
        self.layers = nn.ModuleList([EncoderLayer() for _ in range(n_layers)])  # 6 层

    def forward(self, enc_inputs):
        """
        enc_inputs: [batch, src_len]  中文索引

        返回：
            enc_outputs:     [batch, src_len, d_model]  编码结果
            enc_self_attns:  列表，每层的注意力权重（可视化用）
        """
        # 1. 词嵌入：索引 → 向量
        enc_outputs = self.src_emb(enc_inputs)  # [batch, src_len, d_model]

        # 2. 加位置编码
        # transpose 是因为 PositionalEncoding 期望的输入形状是 (seq_len, batch, d_model)
        # 加完再 transpose 回来
        enc_outputs = self.pos_emb(enc_outputs.transpose(0, 1)).transpose(0, 1)

        # 3. 生成 Pad Mask
        enc_self_attn_mask = get_attn_pad_mask(enc_inputs, enc_inputs)

        # 4. 通过 6 层 Encoder（上一层的输出是下一层的输入）
        enc_self_attns = []
        for layer in self.layers:
            enc_outputs, enc_self_attn = layer(enc_outputs, enc_self_attn_mask)
            enc_self_attns.append(enc_self_attn)

        return enc_outputs, enc_self_attns


class Decoder(nn.Module):
    """
    完整的 Decoder：把 N 个 Decoder 层叠在一起。

    数据流：
      英文索引 → Embedding → 加位置编码 → 生成两种 Mask → 通过 6 个 Decoder 层
    """
    def __init__(self):
        super(Decoder, self).__init__()
        self.tgt_emb = nn.Embedding(tgt_vocab_size, d_model)
        self.pos_emb = PositionalEncoding(d_model)
        self.layers = nn.ModuleList([DecoderLayer() for _ in range(n_layers)])

    def forward(self, dec_inputs, enc_inputs, enc_outputs):
        """
        dec_inputs:  [batch, tgt_len]  英文输入索引（带 S 开头）
        enc_inputs:  [batch, src_len]  中文输入索引（用来生成 Encoder 的 Pad Mask）
        enc_outputs: [batch, src_len, d_model]  Encoder 的输出
        """
        # 1. 词嵌入 + 位置编码
        dec_outputs = self.tgt_emb(dec_inputs)
        dec_outputs = self.pos_emb(dec_outputs.transpose(0, 1)).transpose(0, 1)

        # 2. 生成 Decoder 自注意力的 Mask（两种 mask 合并）
        #
        # Pad Mask：遮盖填充符号 S（索引为 0）
        dec_self_attn_pad_mask = get_attn_pad_mask(dec_inputs, dec_inputs)
        #
        # 因果 Mask：遮盖未来位置（上三角矩阵）
        dec_self_attn_subsequence_mask = get_attn_subsequence_mask(dec_inputs)
        #
        # 合并：两个矩阵相加，>0 的位置就是要遮盖的
        # 因为一个是 True/False（0/1），一个是 0/1，相加后：
        #   0 = 都不遮盖（正常位置）
        #   1 或 2 = 至少有一个要遮盖
        # torch.gt(x, 0) 就是 x > 0，返回 True/False
        dec_self_attn_mask = torch.gt(
            (dec_self_attn_pad_mask + dec_self_attn_subsequence_mask), 0
        )

        # 3. 生成 Encoder-Decoder 交叉注意力的 Mask
        # 只需要 Pad Mask（遮盖中文句子中的 P），不需要因果 mask
        # 因为 Encoder 已经处理完了整个中文句子，Decoder 可以看所有中文
        dec_enc_attn_mask = get_attn_pad_mask(dec_inputs, enc_inputs)

        # 4. 通过 6 层 Decoder
        dec_self_attns, dec_enc_attns = [], []
        for layer in self.layers:
            dec_outputs, dec_self_attn, dec_enc_attn = layer(
                dec_outputs, enc_outputs, dec_self_attn_mask, dec_enc_attn_mask
            )
            dec_self_attns.append(dec_self_attn)
            dec_enc_attns.append(dec_enc_attn)

        return dec_outputs, dec_self_attns, dec_enc_attns


# ============================================================
#  第八站（续）：完整 Transformer
# ============================================================
#
#  最终的数据流：
#
#  中文索引 ──→ Encoder(6层) ──→ enc_outputs ──┐
#                                               │
#  英文索引 ──→ Decoder(6层) ──────────────────┘──→ 线性层 ──→ 概率分布
#               ↑                                 (映射到词汇表大小)
#               └── 交叉注意力时用 enc_outputs 作为 K, V

class Transformer(nn.Module):
    def __init__(self):
        super(Transformer, self).__init__()
        self.Encoder = Encoder()
        self.Decoder = Decoder()
        # 最后一个线性层：把 d_model 映射到目标词汇表大小
        # 输出的每个位置都是一个概率分布，表示"这个位置是每个词的概率"
        self.projection = nn.Linear(d_model, tgt_vocab_size, bias=False)

    def forward(self, enc_inputs, dec_inputs):
        """
        enc_inputs: [batch, src_len]  中文索引
        dec_inputs: [batch, tgt_len]  英文索引

        返回：
            dec_logits:       [batch * tgt_len, tgt_vocab_size]  预测概率
            enc_self_attns:   Encoder 各层注意力权重
            dec_self_attns:   Decoder 各层自注意力权重
            dec_enc_attns:    Decoder 各层交叉注意力权重
        """
        # 1. Encoder 编码中文
        enc_outputs, enc_self_attns = self.Encoder(enc_inputs)

        # 2. Decoder 解码英文（同时参考 Encoder 的输出）
        dec_outputs, dec_self_attns, dec_enc_attns = self.Decoder(
            dec_inputs, enc_inputs, enc_outputs
        )

        # 3. 线性投影到词汇表大小
        dec_logits = self.projection(dec_outputs)  # [batch, tgt_len, tgt_vocab_size]

        # 4. 展平 batch 和 tgt_len 维度，方便算交叉熵
        # [batch, tgt_len, vocab_size] → [batch * tgt_len, vocab_size]
        dec_logits = dec_logits.view(-1, dec_logits.size(-1))

        return dec_logits, enc_self_attns, dec_self_attns, dec_enc_attns


# ============================================================
#  第九站：训练和测试
# ============================================================

print("=" * 60)
print("开始训练 Transformer")
print("=" * 60)

# --------------------------------------------------
#  定义模型、损失函数、优化器
# --------------------------------------------------
model = Transformer()

# 交叉熵损失函数——和你 NumPy 版本的 cross_entropy_loss 是同一个东西
# ignore_index=0：忽略目标中索引为 0 的位置（S 是开始符号，不需要预测）
criterion = nn.CrossEntropyLoss(ignore_index=0)

# SGD 优化器：和你 NumPy 版本的 W -= lr * grad 思路一样
# momentum=0.99：加入动量，让参数更新更平滑（相当于"有惯性的梯度下降"）
optimizer = optim.SGD(model.parameters(), lr=1e-3, momentum=0.99)

# --------------------------------------------------
#  训练循环
# --------------------------------------------------
#
#  和你 NumPy 版本的训练循环结构完全一样：
#    前向传播 → 算损失 → 反向传播 → 更新参数
#
#  区别是：PyTorch 自动帮你算了梯度，不需要手动写 backward() 函数！
#  loss.backward() 一行就搞定了你在 NumPy 里手写的 100 多行反向传播代码。
#  这就是框架的价值——让你专注于模型设计，不用手写每一层的梯度公式。

for epoch in range(300):
    for enc_inputs_batch, dec_inputs_batch, dec_outputs_batch in train_loader:
        # 1. 前向传播
        outputs, enc_self_attns, dec_self_attns, dec_enc_attns = model(
            enc_inputs_batch, dec_inputs_batch
        )

        # 2. 计算损失
        # outputs: [batch * tgt_len, tgt_vocab_size]
        # dec_outputs_batch.view(-1): [batch * tgt_len]
        loss = criterion(outputs, dec_outputs_batch.view(-1))

        # 3. 反向传播
        optimizer.zero_grad()  # 清零梯度（PyTorch 默认会累加梯度，需要手动清零）
        loss.backward()        # 自动计算所有参数的梯度（就是你在 NumPy 里手写的那些！）
        optimizer.step()       # 更新参数：param -= lr * grad

    if (epoch + 1) % 50 == 0:
        print(f"Epoch: {epoch + 1:04d} | Loss: {loss.item():.6f}")

print()

# --------------------------------------------------
#  测试：用训练好的模型翻译
# --------------------------------------------------
#
#  训练时 Decoder 一次看完所有输入（Teacher Forcing）。
#  测试时没有正确答案，只能逐词生成：
#    1. 先输入 S，预测第一个词
#    2. 把预测的词拼回去，再预测下一个词
#    3. 重复直到预测出 E（结束符号）或达到最大长度
#
#  这就是你 NumPy 版本里"从 h 开始逐步生成"的思路！

print("=" * 60)
print("测试翻译结果")
print("=" * 60)


def test(model, enc_input, start_symbol):
    """
    自回归生成：逐词预测

    enc_input: [1, src_len]  一条中文输入
    start_symbol: 起始符号的索引（S=0）
    """
    # 先用 Encoder 编码中文
    enc_outputs, _ = model.Encoder(enc_input)

    # 初始化 Decoder 输入（全 0，即全是 S）
    dec_input = torch.zeros(1, tgt_len).type_as(enc_input.data)

    next_symbol = start_symbol

    for i in range(tgt_len):
        dec_input[0][i] = next_symbol    # 把预测的词填入当前位置

        # Decoder 解码
        dec_outputs, _, _ = model.Decoder(dec_input, enc_input, enc_outputs)

        # 线性投影得到每个位置的词汇概率
        projected = model.projection(dec_outputs)  # [1, tgt_len, tgt_vocab_size]

        # 取每个位置概率最大的词
        prob = projected.squeeze(0).max(dim=-1, keepdim=False)[1]  # [tgt_len]

        # 只取当前位置的预测词作为下一个输入
        next_word = prob.data[i]
        next_symbol = next_word.item()

    return dec_input


print("=" * 60)
print("【训练集】翻译结果（模型见过这些数据）")
print("=" * 60)
train_enc_all, _, _ = next(iter(train_loader))
for i in range(len(train_enc_all)):
    enc_input = train_enc_all[i].view(1, -1)
    predict_dec_input = test(model, enc_input, start_symbol=tgt_vocab["S"])
    predict, _, _, _ = model(enc_input, predict_dec_input)
    predict = predict.data.max(1, keepdim=True)[1]
    src_sentence = [src_idx2word[int(n)] for n in enc_input.squeeze()]
    tgt_sentence = [tgt_idx2word[n.item()] for n in predict.squeeze()]
    print(f"{' '.join(src_sentence)}  →  {' '.join(tgt_sentence)}")

print()
print("=" * 60)
print("【测试集】翻译结果（模型没见过这些数据！）")
print("=" * 60)
test_enc_all, _, _ = next(iter(test_loader))
for i in range(len(test_enc_all)):
    enc_input = test_enc_all[i].view(1, -1)
    predict_dec_input = test(model, enc_input, start_symbol=tgt_vocab["S"])
    predict, _, _, _ = model(enc_input, predict_dec_input)
    predict = predict.data.max(1, keepdim=True)[1]
    src_sentence = [src_idx2word[int(n)] for n in enc_input.squeeze()]
    tgt_sentence = [tgt_idx2word[n.item()] for n in predict.squeeze()]
    correct = test_sentences[i][2].split()
    print(f"{' '.join(src_sentence)}  →  {' '.join(tgt_sentence)}  (正确答案: {' '.join(correct)})")
