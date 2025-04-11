import pandas as pd
import json
import os
import numpy as np
from typing import Tuple, List, Dict, Optional
from dataclasses import dataclass
import traceback

@dataclass
class ExtractedData:
    """提取的数据结构"""
    monthly_data: List[float]
    total: float

def safe_float_convert(value) -> float:
    """安全地将值转换为浮点数"""
    try:
        if pd.isna(value):
            return 0.0
        return float(value)
    except (ValueError, TypeError):
        return 0.0

def extract_monthly_data(df: pd.DataFrame, rows: pd.DataFrame, months: List[str]) -> ExtractedData:
    """从指定的行中提取月度数据"""
    monthly_data = []
    for month in months:
        try:
            value = rows[month].values[0] if len(rows) > 0 else 0
            value = safe_float_convert(value)
            monthly_data.append(value)
        except Exception as e:
            print(f"处理月份 {month} 数据时出错: {e}")
            monthly_data.append(0.0)
    
    total = sum(monthly_data)
    return ExtractedData(monthly_data=monthly_data, total=total)

def read_excel_data(file_path: str) -> Optional[pd.DataFrame]:
    """读取Excel文件数据"""
    try:
        # 读取Excel文件，跳过可能的空行
        df = pd.read_excel(file_path, na_filter=True)
        print(f"成功读取Excel文件: {file_path}")
        
        # 基本信息打印
        print(f"原始数据列: {df.columns.tolist()}")
        print(f"原始数据行数: {len(df)}")
        
        # 清理数据
        df = df.dropna(how='all')  # 删除完全为空的行
        numeric_columns = [col for col in df.columns if '金额' in col]
        df[numeric_columns] = df[numeric_columns].fillna(0)
        
        print("\n清理后的数据预览:")
        print(df.head(10))
        
        # 打印关键列的唯一值
        for col in ['名目', '类别']:
            print(f"\n{col}列的所有值:")
            print(df[col].dropna().unique())
        
        return df
    except Exception as e:
        print(f"读取Excel文件出错: {e}")
        print(traceback.format_exc())
        return None

def extract_data_by_keyword(df: pd.DataFrame, months: List[str], keyword: str, 
                          columns: List[str]) -> Tuple[List[float], float]:
    """根据关键字从指定列中提取数据"""
    try:
        print(f"\n开始提取{keyword}数据...")
        print(f"在以下列中查找关键字'{keyword}': {columns}")
        
        for column in columns:
            rows = df[df[column].str.contains(keyword, na=False, case=False)]
            if not rows.empty:
                print(f"\n在{column}列中找到{keyword}数据")
                print("找到的行数:", len(rows))
                print("完整行数据:")
                print(rows)
                
                extracted = extract_monthly_data(df, rows, months)
                print(f"\n提取的数据:")
                print(f"总{keyword}: {extracted.total}")
                print(f"月度{keyword}数据: {extracted.monthly_data}")
                
                return extracted.monthly_data, extracted.total
        
        print(f"\n在所有指定列中都未找到{keyword}数据")
        return [], 0.0
            
    except Exception as e:
        print(f"提取{keyword}数据时出错: {e}")
        print(traceback.format_exc())
        return [], 0.0

def extract_salary_data(df: pd.DataFrame, months: List[str]) -> Tuple[List[float], float]:
    """专门用于从数据中提取人员工资信息"""
    return extract_data_by_keyword(df, months, '人员工资', ['名目', '类别'])

def extract_cashier_revenue(df: pd.DataFrame, months: List[str]) -> Tuple[List[float], float]:
    """专门用于从数据中提取收银营业收入信息"""
    print("\n开始提取收银营业收入数据...")
    print("查找条件：名目 = '收银台营业收入'")
    
    # 打印所有可能的名目值
    print("\n当前Excel中的所有名目值：")
    print(df['名目'].unique())
    
    return extract_data_by_keyword(df, months, '收银台营业收入', ['名目'])

def extract_member_revenue(df: pd.DataFrame, months: List[str]) -> Tuple[List[float], float]:
    """专门用于从数据中提取会员收入信息（通过计算含会员充值和不含会员充值的差值）"""
    try:
        print("\n开始提取会员收入数据...")
        
        # 查找收银台营业收入（含会员充值）的行
        with_member_rows = df[df['名目'] == '收银台营业收入（含会员充值）']
        # 查找普通收银台营业收入的行
        without_member_rows = df[df['名目'] == '收银台营业收入']
        
        if not with_member_rows.empty and not without_member_rows.empty:
            print("\n找到会员收入相关数据")
            print("含会员充值数据:")
            print(with_member_rows)
            print("\n不含会员充值数据:")
            print(without_member_rows)
            
            # 提取两种收入数据
            with_member = extract_monthly_data(df, with_member_rows, months)
            without_member = extract_monthly_data(df, without_member_rows, months)
            
            # 计算差值得到会员收入
            member_data = [w - wo for w, wo in zip(with_member.monthly_data, without_member.monthly_data)]
            total_member = sum(member_data)
            
            print(f"\n提取的会员收入数据:")
            print(f"总会员收入: {total_member}")
            print(f"月度会员收入数据: {member_data}")
            
            return member_data, total_member
        
        print("\n未找到会员收入相关数据")
        return [], 0.0
            
    except Exception as e:
        print(f"提取会员收入数据时出错: {e}")
        print(traceback.format_exc())
        return [], 0.0

def analyze_data(df: pd.DataFrame) -> Dict:
    """分析数据，生成可视化所需的各种数据结构"""
    if df is None or df.empty:
        print("输入数据为空，无法进行分析")
        return {}
    
    try:
        print("\n=== 开始数据分析 ===")
        
        # 确保输出目录存在
        os.makedirs('data', exist_ok=True)
        
        # 清洗数据
        df = df.dropna(how='all')
        df = df.fillna(0)
        
        # 提取月份信息
        months = [col for col in df.columns if '金额' in col]
        month_labels = [col.replace('金额（', '').replace('）', '') for col in months]
        print(f"\n月份列表: {month_labels}")
        
        # 初始化结果字典
        results = {
            "months": month_labels,
            "category_trend": {},
            "monthly_summary": [],
            "category_distribution": [],
            "store_performance": {}
        }
        
        print("\n=== 数据提取过程 ===")
        
        # 1. 收入类数据提取
        print("\n=== 收入类数据提取 ===")
        
        # 1.1 综合营业收入
        total_revenue_data, total_revenue = extract_data_by_keyword(df, months, '综合营业收入', ['名目'])
        if total_revenue_data:
            results["category_trend"]["综合营业收入"] = total_revenue_data
            results["category_distribution"].append({
                "category": "综合营业收入",
                "total": total_revenue
            })
            print("\n综合营业收入数据:")
            print(f"综合营业收入总额: {total_revenue}")
            print(f"月度综合营业收入数据: {total_revenue_data}")
        
        # 1.2 收银营业收入
        cashier_data, total_cashier = extract_data_by_keyword(df, months, '收银台营业收入', ['名目'])
        if cashier_data:
            results["category_trend"]["收银收入"] = cashier_data
            results["category_distribution"].append({
                "category": "收银收入",
                "total": total_cashier
            })
        
        # 1.3 会员收入
        member_data, total_member = extract_member_revenue(df, months)
        if member_data:
            results["category_trend"]["会员收入"] = member_data
            results["category_distribution"].append({
                "category": "会员收入",
                "total": total_member
            })
        
        # 1.4 实际收益（美团、饿了么）
        actual_revenue_data, actual_revenue = extract_data_by_keyword(df, months, '含美团，饿了么扣除损耗推广等的实际收益', ['名目'])
        if actual_revenue_data:
            results["category_trend"]["实际收益"] = actual_revenue_data
            results["category_distribution"].append({
                "category": "实际收益",
                "total": actual_revenue
            })
        
        # 2. 支出类数据提取
        print("\n=== 支出类数据提取 ===")
        
        # 初始化总成本数据
        total_cost_data = [0.0] * len(months)
        
        # 2.1 人员工资
        salary_data, total_salary = extract_salary_data(df, months)
        if salary_data:
            results["category_trend"]["人员工资"] = salary_data
            results["category_distribution"].append({
                "category": "人员工资",
                "total": total_salary
            })
            # 添加到总成本
            total_cost_data = [x + y for x, y in zip(total_cost_data, salary_data)]
        
        # 2.2 物料支出
        material_keywords = {
            '品牌方物料（当月进货）': '品牌物料',
            '品牌方补物料': '补充物料',
            '其他物料采购': '其他物料',
            '快驴采购': '快驴采购',
            '物流采购': '物流采购'
        }
        for keyword, display_name in material_keywords.items():
            data, total = extract_data_by_keyword(df, months, keyword, ['名目'])
            if data:
                results["category_trend"][display_name] = data
                results["category_distribution"].append({
                    "category": display_name,
                    "total": total
                })
                # 添加到总成本
                total_cost_data = [x + y for x, y in zip(total_cost_data, data)]
        
        # 直接从Excel表中提取物料支出合计数据
        print("\n开始提取物料支出合计数据...")
        material_total_rows = df[df['类别'] == '物料支出合计']
        if not material_total_rows.empty:
            material_total_extracted = extract_monthly_data(df, material_total_rows, months)
            material_total_data = material_total_extracted.monthly_data
            material_total = material_total_extracted.total
            
            results["category_trend"]["物料支出合计"] = material_total_data
            results["category_distribution"].append({
                "category": "物料支出合计",
                "total": material_total
            })
            print("\n物料支出合计数据:")
            print(f"总额: {material_total}")
            print(f"月度数据: {material_total_data}")
            print("\n找到的物料支出合计行:")
            print(material_total_rows[['名目', '类别'] + months])
        else:
            print("\n未找到物料支出合计数据")
        
        # 2.3 其他支出
        other_keywords = {
            '电费': '电费',
            '水费': '水费',
            '固定成本支出': '固定成本',
            '其他采购': '其他支出'
        }
        for keyword, display_name in other_keywords.items():
            data, total = extract_data_by_keyword(df, months, keyword, ['名目'])
            if data:
                results["category_trend"][display_name] = data
                results["category_distribution"].append({
                    "category": display_name,
                    "total": total
                })
                # 添加到总成本
                total_cost_data = [x + y for x, y in zip(total_cost_data, data)]
        
        # 2.4 提取综合支出合计数据
        total_expense_data, total_expense = extract_data_by_keyword(df, months, '综合支出合计', ['名目', '类别'])
        if total_expense_data:
            results["category_trend"]["综合支出合计"] = total_expense_data
            results["category_distribution"].append({
                "category": "综合支出合计",
                "total": total_expense
            })
            print("\n综合支出合计数据:")
            print(f"总额: {total_expense}")
            print(f"月度数据: {total_expense_data}")
        
        # 3. 计算月度汇总数据
        print("\n=== 计算月度汇总数据 ===")
        
        # 计算利润数据
        profit_data = [r - c for r, c in zip(total_revenue_data, total_cost_data)]
        
        # 添加到趋势数据
        results["category_trend"]["总成本"] = total_cost_data
        
        # 计算月度汇总
        for i in range(len(months)):
            current_month = {
                "month": month_labels[i],
                "revenue": total_revenue_data[i],
                "cost": total_cost_data[i],
                "profit": profit_data[i],
                "revenue_mom": 0.0 if i == 0 else ((total_revenue_data[i] - total_revenue_data[i-1]) / total_revenue_data[i-1] * 100 if total_revenue_data[i-1] != 0 else 0),
                "cost_mom": 0.0 if i == 0 else ((total_cost_data[i] - total_cost_data[i-1]) / total_cost_data[i-1] * 100 if total_cost_data[i-1] != 0 else 0),
                "profit_mom": 0.0 if i == 0 else ((profit_data[i] - profit_data[i-1]) / abs(profit_data[i-1]) * 100 if profit_data[i-1] != 0 else 0)
            }
            results["monthly_summary"].append(current_month)
        
        print("\n=== 最终结果 ===")
        print(f"类别趋势数据: {list(results['category_trend'].keys())}")
        print(f"类别分布数据: {[item['category'] for item in results['category_distribution']]}")
        
        # 保存结果到JSON文件
        json_file = 'data/analysis_results.json'
        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
        print(f"\n分析结果已保存到: {json_file}")
        
        return results
        
    except Exception as e:
        print(f"数据分析过程出错: {e}")
        print(traceback.format_exc())
        return {}

if __name__ == "__main__":
    file_path = "data/快餐连锁店营业情况202404-202503.xlsx"
    df = read_excel_data(file_path)
    
    if df is not None:
        # 打印数据的前几行以便了解数据结构
        print("\n数据预览:")
        print(df.head())
        
        # 分析数据
        results = analyze_data(df)
        print("\n分析完成，数据已保存到 data/analysis_results.json") 