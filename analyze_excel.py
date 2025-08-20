import pandas as pd
import sys
import io

# 设置输出编码
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

try:
    # 读取Excel文件
    df = pd.read_excel(r'C:\Users\Ross\Desktop\未分组表.xlsx')
    
    print("文件读取成功！")
    print(f"总行数: {len(df)}")
    print(f"总列数: {len(df.columns)}")
    print("\n=== 列名 ===")
    for i, col in enumerate(df.columns):
        print(f"{i+1}. {col}")
    
    print("\n=== 前5行数据预览 ===")
    print(df.head().to_string(index=False))
    
    print("\n=== 数据类型 ===")
    print(df.dtypes)
    
    print("\n=== 缺失值统计 ===")
    print(df.isnull().sum())
    
    # 如果有性别列，统计性别分布
    gender_columns = [col for col in df.columns if '性别' in col]
    if gender_columns:
        print(f"\n=== 性别分布 ({gender_columns[0]}) ===")
        print(df[gender_columns[0]].value_counts())
    
    # 如果有年龄列，统计年龄分布
    age_columns = [col for col in df.columns if '年龄' in col or 'age' in col.lower()]
    if age_columns:
        print(f"\n=== 年龄统计 ({age_columns[0]}) ===")
        print(f"最小年龄: {df[age_columns[0]].min()}")
        print(f"最大年龄: {df[age_columns[0]].max()}")
        print(f"平均年龄: {df[age_columns[0]].mean():.1f}")

except Exception as e:
    print(f"读取文件时出错: {e}")
    sys.exit(1)