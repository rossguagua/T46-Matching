import pandas as pd
import sys
import io

# 设置输出编码
sys.stdout.reconfigure(encoding='utf-8')

try:
    # 读取Excel文件查看格式
    df = pd.read_excel(r'C:\Users\Ross\Desktop\副本0813活动分组.xlsx', sheet_name=0)
    
    print("=== 参考Excel文件格式分析 ===")
    print(f"文件形状: {df.shape}")
    print(f"列数: {len(df.columns)}")
    
    print("\n=== A列和B列(组号和编号) ===")
    if len(df.columns) >= 2:
        col_a = df.columns[0]  # 组号列
        col_b = df.columns[1]  # 编号列
        print(f"A列名称: {repr(col_a)}")
        print(f"B列名称: {repr(col_b)}")
        
        print(f"\nA列前15个值:")
        for i, val in enumerate(df[col_a].head(15).tolist()):
            print(f"  {i+1:2d}. {repr(val)}")
            
        print(f"\nB列前15个值:")  
        for i, val in enumerate(df[col_b].head(15).tolist()):
            print(f"  {i+1:2d}. {repr(val)}")
    
    print("\n=== 组号统计 ===")
    if len(df.columns) >= 1:
        group_counts = df[df.columns[0]].value_counts()
        print("各组人数分布:")
        for group, count in group_counts.items():
            print(f"  {group}: {count}人")

except Exception as e:
    print(f"读取失败: {e}")