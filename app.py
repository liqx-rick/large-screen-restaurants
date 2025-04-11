from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import json
import os
import pandas as pd
from analyze_data import read_excel_data, analyze_data
from typing import Dict, List, Union, Optional

# 自定义异常类
class DataProcessError(Exception):
    """数据处理相关的异常"""
    pass

class FileOperationError(Exception):
    """文件操作相关的异常"""
    pass

app = FastAPI(title="快餐连锁店大屏API", description="为快餐连锁店大屏提供数据服务的API")

# 添加CORS支持，允许前端访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 允许所有来源，生产环境中应该限制为特定的前端URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 数据文件路径
EXCEL_FILE = "data/快餐连锁店营业情况202404-202503.xlsx"
JSON_FILE = "data/analysis_results.json"

# 确保数据目录存在
os.makedirs('data', exist_ok=True)

def load_json_data() -> Dict:
    """加载JSON数据文件的通用函数"""
    try:
        if not os.path.exists(JSON_FILE):
            raise FileOperationError("数据文件不存在，请先刷新数据")
        with open(JSON_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except json.JSONDecodeError:
        raise DataProcessError("数据文件格式错误")
    except Exception as e:
        raise FileOperationError(f"读取数据文件失败: {str(e)}")

@app.get("/")
async def root():
    return {"message": "快餐连锁店大屏API服务正常运行"}

@app.get("/api/refresh-data")
async def refresh_data():
    """刷新数据分析，重新从Excel文件读取并分析数据"""
    try:
        if not os.path.exists(EXCEL_FILE):
            raise FileOperationError("Excel文件不存在")
        
        df = read_excel_data(EXCEL_FILE)
        if df is None:
            raise DataProcessError("Excel文件读取失败")
        
        results = analyze_data(df)
        if not results:
            raise DataProcessError("数据分析失败")
            
        return {"status": "success", "message": "数据已成功刷新"}
    except FileOperationError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except DataProcessError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"未知错误: {str(e)}")

@app.get("/api/data/summary")
async def get_summary():
    """获取数据摘要，包括月份列表和月度总结"""
    try:
        data = load_json_data()
        return {
            "months": data.get("months", []),
            "monthly_summary": data.get("monthly_summary", [])
        }
    except (FileOperationError, DataProcessError) as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/data/trends")
async def get_trends():
    """获取类别趋势数据"""
    try:
        data = load_json_data()
        return {
            "months": data.get("months", []),
            "category_trend": data.get("category_trend", {})
        }
    except (FileOperationError, DataProcessError) as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/data/distribution")
async def get_distribution():
    """获取类别分布数据"""
    try:
        data = load_json_data()
        return {
            "category_distribution": data.get("category_distribution", [])
        }
    except (FileOperationError, DataProcessError) as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/data/growth")
async def get_growth():
    """获取增长率数据"""
    try:
        data = load_json_data()
        return {
            "growth_rate": data.get("growth_rate", [])
        }
    except (FileOperationError, DataProcessError) as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/data/all")
async def get_all_data():
    """获取所有分析数据"""
    try:
        return load_json_data()
    except (FileOperationError, DataProcessError) as e:
        raise HTTPException(status_code=500, detail=str(e))

# 配置静态文件服务，用于前端页面
app.mount("/frontend", StaticFiles(directory="frontend", html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    # 启动前确保数据已分析
    try:
        if not os.path.exists(JSON_FILE):
            if not os.path.exists(EXCEL_FILE):
                print(f"警告: Excel文件不存在 ({EXCEL_FILE})")
            else:
                print("首次启动，正在分析数据...")
                df = read_excel_data(EXCEL_FILE)
                if df is not None:
                    analyze_data(df)
                    print("数据分析完成")
                else:
                    print("警告: Excel文件读取失败")
    except Exception as e:
        print(f"警告: 初始化数据分析失败 - {str(e)}")
    
    # 启动服务
    uvicorn.run(app, host="0.0.0.0", port=8000) 