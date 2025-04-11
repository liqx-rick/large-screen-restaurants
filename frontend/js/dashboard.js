// 全局API基础URL
const API_BASE_URL = window.location.origin;

// Vue应用
const app = Vue.createApp({
    data() {
        return {
            currentTime: '',
            lastUpdated: '-',
            keyStats: [
                { title: '本月总营收', value: '0', trend: 0 },
                { title: '本月总成本', value: '0', trend: 0 },
                { title: '本月盈亏', value: '0', trend: 0 },
                { title: '同比上月', value: '0%', trend: 0 }
            ],
            allData: null,
            charts: {},
            // 新增：汇总表格数据
            summaryTableData: []
        };
    },
    methods: {
        // 更新时间
        updateTime() {
            const now = new Date();
            this.currentTime = now.toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            });
        },
        
        // 格式化数字为货币格式
        formatCurrency(value) {
            return new Intl.NumberFormat('zh-CN', {
                style: 'currency',
                currency: 'CNY',
                minimumFractionDigits: 2
            }).format(value);
        },
        
        // 加载所有数据
        async loadAllData() {
            try {
                console.log('开始加载数据...');
                const response = await axios.get(`${API_BASE_URL}/api/data/all`);
                console.log('API响应:', response);
                
                if (!response.data) {
                    throw new Error('API返回的数据为空');
                }
                
                this.allData = response.data;
                console.log('加载的数据:', this.allData);
                
                // 检查必要的数据结构
                if (!this.allData.months || !Array.isArray(this.allData.months)) {
                    throw new Error('缺少月份数据或格式不正确');
                }
                
                if (!this.allData.category_trend || typeof this.allData.category_trend !== 'object') {
                    throw new Error('缺少类别趋势数据或格式不正确');
                }
                
                if (!this.allData.category_distribution || !Array.isArray(this.allData.category_distribution)) {
                    throw new Error('缺少类别分布数据或格式不正确');
                }
                
                this.lastUpdated = new Date().toLocaleString('zh-CN');
                console.log('数据加载完成，开始更新统计和图表');
                
                // 显示每月人员工资数据
                this.showMonthlySalaryData();
                
                // 更新统计数据和图表
                this.updateKeyStats();
                this.updateSummaryTable();
                this.renderAllCharts();
                
                console.log('所有更新完成');
            } catch (error) {
                console.error('加载数据时出错:', error);
                const errorMessage = error.response ? 
                    `加载数据失败: ${error.response.status} - ${error.response.statusText}\n具体错误: ${error.response.data || '未知错误'}` :
                    `加载数据失败: ${error.message || '未知错误'}`;
                alert(errorMessage);
            }
        },
        
        // 刷新数据
        async refreshData() {
            try {
                await axios.get(`${API_BASE_URL}/api/refresh-data`);
                await this.loadAllData();
                alert('数据已成功刷新！');
            } catch (error) {
                console.error('刷新数据失败:', error);
                alert('刷新数据失败，请稍后重试');
            }
        },
        
        // 更新关键指标卡片
        updateKeyStats() {
            if (!this.allData || !this.allData.monthly_summary) {
                console.log('数据检查 - allData:', !!this.allData);
                console.log('数据检查 - monthly_summary:', !!this.allData?.monthly_summary);
                return;
            }
            
            // 获取最新月度数据和上一个月度数据
            const months = this.allData.months;
            const latestMonthIndex = months.length - 1;
            const previousMonthIndex = months.length - 2;
            
            console.log('月份信息:', {
                总月份数: months.length,
                所有月份: months,
                当前月份索引: latestMonthIndex,
                上月索引: previousMonthIndex,
                当前月份: months[latestMonthIndex],
                上月: months[previousMonthIndex]
            });
            
            if (latestMonthIndex < 0 || previousMonthIndex < 0) {
                console.log('月份索引无效，退出更新');
                return;
            }
            
            // 打印所有可用的类别
            console.log('所有可用的类别:', Object.keys(this.allData.category_trend));
            console.log('类别分布数据:', this.allData.category_distribution);
            
            // 使用"综合营业收入"作为总营收数据
            if (!this.allData.category_trend["综合营业收入"]) {
                console.error("未找到综合营业收入数据");
                return;
            }
            
            // 获取收入数据
            const revenueData = this.allData.category_trend["综合营业收入"];
            const latestRevenue = revenueData[latestMonthIndex] || 0;
            const previousRevenue = revenueData[previousMonthIndex] || 0;
            
            console.log('收入数据:', {
                完整数据: revenueData,
                当月收入: latestRevenue,
                上月收入: previousRevenue
            });
            
            let latestCost = 0;
            let previousCost = 0;
            
            // 获取"收银营业收入"数据
            if (this.allData.category_trend["收银收入"]) {
                cashierRevenueData = this.allData.category_trend["收银收入"];
                console.log('从收银收入获取的数据:', cashierRevenueData);
            }
            
            // 获取"外卖平台营业收入"数据
            if (this.allData.category_trend["实际收益"]) {
                takeoutRevenueData = this.allData.category_trend["实际收益"];
                console.log('从实际收益获取的外卖平台营业收入数据:', takeoutRevenueData);
            }
            
            // 计算每月利润数据
            profitData = months.map((_, index) => {
                const revenue = revenueData[index] || 0;
                const salary = this.allData.category_trend["人员工资"]?.[index] || 0;
                const material = this.allData.category_trend["物料支出合计"]?.[index] || 0;
                const otherCost = this.allData.category_trend["综合支出合计"]?.[index] || 0;
                return revenue - salary - material - (otherCost - salary);
            });
            
            console.log('计算的利润数据:', profitData);
            
            // 获取人员工资数据
            let totalSalaryCost = 0;
            if (this.allData.category_distribution) {
                const salaryData = this.allData.category_distribution.find(item => item.category === '人员工资');
                if (salaryData) {
                    totalSalaryCost = salaryData.total;
                }
            }
            
            // 获取成本数据
            // 1. 人员工资
            if (this.allData.category_trend["人员工资"]) {
                const salaryData = this.allData.category_trend["人员工资"];
                latestCost += salaryData[latestMonthIndex] || 0;
                previousCost += salaryData[previousMonthIndex] || 0;
            }
            
            // 2. 物料支出
            if (this.allData.category_trend["物料支出合计"]) {
                const materialData = this.allData.category_trend["物料支出合计"];
                latestCost += materialData[latestMonthIndex] || 0;
                previousCost += materialData[previousMonthIndex] || 0;
                console.log('物料支出合计数据:', {
                    完整数据: materialData,
                    当月物料支出: materialData[latestMonthIndex],
                    上月物料支出: materialData[previousMonthIndex]
                });
            } else {
                console.warn('未找到物料支出合计数据');
            }
            
            // 3. 获取并计算综合支出数据
            let totalGeneralExpense = 0;
            
            if (this.allData.category_distribution) {
                const generalExpenseData = this.allData.category_distribution.find(item => item.category === '综合支出合计');
                if (generalExpenseData) {
                    totalGeneralExpense = generalExpenseData.total;
                }
                
                const salaryData = this.allData.category_distribution.find(item => item.category === '人员工资');
                if (salaryData) {
                    totalSalaryCost = salaryData.total;
                }
            }
            
            // 计算其他成本（综合支出减去人员工资）
            const totalOtherCost = totalGeneralExpense - totalSalaryCost;
            const monthlyAvgOtherCost = totalOtherCost / months.length;
            
            // 将月平均其他成本添加到当月和上月成本中
            latestCost += monthlyAvgOtherCost;
            previousCost += monthlyAvgOtherCost;
            
            console.log('成本计算详情:', {
                当月总成本: latestCost,
                上月总成本: previousCost,
                当月人员成本: this.allData.category_trend["人员工资"]?.[latestMonthIndex] || 0,
                当月物料成本: this.allData.category_trend["物料支出合计"]?.[latestMonthIndex] || 0,
                月平均其他成本: monthlyAvgOtherCost
            });
            
            const avgOtherCost = totalOtherCost / months.length;
            const otherCostPct = (totalOtherCost / latestRevenue) * 100;
            
            // 计算盈亏和增长率
            const latestProfit = latestRevenue - latestCost;
            const previousProfit = previousRevenue - previousCost;
            
            // 计算环比增长率
            const revenueTrend = previousRevenue ? ((latestRevenue - previousRevenue) / previousRevenue * 100) : 0;
            
            console.log('盈亏数据:', {
                当前月盈亏: latestProfit,
                上月盈亏: previousProfit,
                环比增长率: revenueTrend,
                当月收入: latestRevenue,
                上月收入: previousRevenue
            });
            
            // 更新关键指标
            this.keyStats = [
                { 
                    title: '本月总营收', 
                    value: this.formatCurrency(latestRevenue), 
                    trend: revenueTrend 
                },
                { 
                    title: '本月总成本', 
                    value: this.formatCurrency(latestCost), 
                    trend: previousCost ? ((latestCost - previousCost) / previousCost * 100) : 0
                },
                { 
                    title: '本月盈亏', 
                    value: this.formatCurrency(latestProfit), 
                    trend: previousProfit ? ((latestProfit - previousProfit) / previousProfit * 100) : 0
                },
                { 
                    title: '同比上月', 
                    value: revenueTrend.toFixed(2) + '%', 
                    trend: revenueTrend 
                }
            ];
        },
        
        // 渲染所有图表
        renderAllCharts() {
            if (!this.allData) return;
            
            // 初始化图表
            this.initCharts();
            
            // 渲染各个图表
            this.renderRevenueTrendChart();
            this.renderCostRevenueRatioChart();
            this.renderCategoryDistributionChart();
            this.renderGrowthRateChart();
            
            // 调整图表大小
            window.addEventListener('resize', this.resizeAllCharts);
        },
        
        // 初始化图表
        initCharts() {
            // 确保DOM元素存在
            const chartElements = [
                'revenue-trend-chart',
                'cost-revenue-ratio-chart',
                'category-distribution-chart',
                'growth-rate-chart'
            ];
            
            // 检查所有图表容器是否存在
            const missingElements = chartElements.filter(id => !document.getElementById(id));
            if (missingElements.length > 0) {
                console.error('缺少图表容器:', missingElements);
                return;
            }
            
            // 销毁已存在的图表实例
            Object.values(this.charts).forEach(chart => {
                if (chart && chart.dispose) {
                    chart.dispose();
                }
            });
            
            // 创建新的图表实例
            this.charts = {
                revenueTrend: echarts.init(document.getElementById('revenue-trend-chart')),
                costRevenueRatio: echarts.init(document.getElementById('cost-revenue-ratio-chart')),
                categoryDistribution: echarts.init(document.getElementById('category-distribution-chart')),
                growthRate: echarts.init(document.getElementById('growth-rate-chart'))
            };
            
            // 设置默认配置
            Object.values(this.charts).forEach(chart => {
                chart.setOption({
                    tooltip: {},
                    grid: {
                        left: '3%',
                        right: '4%',
                        bottom: '3%',
                        containLabel: true
                    }
                });
            });
        },
        
        // 重设图表大小
        resizeAllCharts() {
            Object.values(this.charts).forEach(chart => {
                if (chart && chart.resize) {
                    chart.resize();
                }
            });
        },
        
        // 渲染营收趋势图
        renderRevenueTrendChart() {
            if (!this.charts.revenueTrend || !this.allData.months) return;
            
            const months = this.allData.months;
            let revenueData = Array(months.length).fill(0);
            let profitData = Array(months.length).fill(0);
            let cashierRevenueData = Array(months.length).fill(0);
            let takeoutRevenueData = Array(months.length).fill(0);
            
            // 获取"综合营业收入"数据
            if (this.allData.category_trend["综合营业收入"]) {
                revenueData = this.allData.category_trend["综合营业收入"];
            }
            
            // 获取"收银营业收入"数据
            if (this.allData.category_trend["收银收入"]) {
                cashierRevenueData = this.allData.category_trend["收银收入"];
                console.log('从收银收入获取的数据:', cashierRevenueData);
            }
            
            // 获取"外卖平台营业收入"数据
            if (this.allData.category_trend["实际收益"]) {
                takeoutRevenueData = this.allData.category_trend["实际收益"];
                console.log('从实际收益获取的外卖平台营业收入数据:', takeoutRevenueData);
            }
            
            // 计算每月利润数据
            profitData = months.map((_, index) => {
                const revenue = revenueData[index] || 0;
                const salary = this.allData.category_trend["人员工资"]?.[index] || 0;
                const material = this.allData.category_trend["物料支出合计"]?.[index] || 0;
                const otherCost = this.allData.category_trend["综合支出合计"]?.[index] || 0;
                return revenue - salary - material - (otherCost - salary);
            });
            
            console.log('计算的利润数据:', profitData);
            
            // 处理利润的正负值，将每个数据点转换为包含值和颜色的对象
            const formattedProfitData = profitData.map(value => ({
                value: value,
                itemStyle: {
                    color: value >= 0 ? '#2ed573' : '#ff4757'
                }
            }));
            
            // 重置图表实例，确保更新生效
            if (this.charts.revenueTrend) {
                this.charts.revenueTrend.dispose();
                this.charts.revenueTrend = echarts.init(document.getElementById('revenue-trend-chart'));
            }
            
            const option = {
                tooltip: {
                    trigger: 'axis',
                    formatter: function(params) {
                        let result = params[0].name + '<br/>';
                        params.forEach(param => {
                            let value = param.value;
                            if (typeof value === 'object' && value !== null) {
                                value = value.value; // 如果是对象，获取其中的value属性
                            }
                            let formattedValue = new Intl.NumberFormat('zh-CN', {
                                style: 'currency',
                                currency: 'CNY'
                            }).format(value);
                            
                            result += param.marker + ' ' + param.seriesName + ': ' + formattedValue + '<br/>';
                        });
                        return result;
                    }
                },
                legend: {
                    data: ['营业收入', '收银营业收入', '外卖平台营业收入', '利润'],
                    textStyle: { color: '#e8eaef' }
                },
                grid: {
                    left: '3%',
                    right: '4%',
                    bottom: '3%',
                    containLabel: true
                },
                xAxis: {
                    type: 'category',
                    data: months,
                    axisLine: { lineStyle: { color: '#2a3366' } },
                    axisLabel: { color: '#a3a8c3' }
                },
                yAxis: {
                    type: 'value',
                    axisLine: { lineStyle: { color: '#2a3366' } },
                    axisLabel: { color: '#a3a8c3' },
                    splitLine: { lineStyle: { color: '#1c2755' } }
                },
                series: [
                    {
                        name: '营业收入',
                        type: 'line',
                        smooth: true,
                        data: revenueData,
                        itemStyle: { color: '#3498db' },
                        label: {
                            show: true,
                            position: 'top',
                            formatter: function(params) {
                                const value = params.value;
                                if (value >= 10000) {
                                    const num = (value / 10000).toFixed(3);
                                    return '¥' + num + '万';
                                } else {
                                    return '¥' + value.toFixed(3);
                                }
                            },
                            textStyle: {
                                fontSize: 12,
                                color: '#3498db',
                                fontWeight: 'bold'
                            },
                            distance: 5
                        },
                        areaStyle: {
                            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                                { offset: 0, color: 'rgba(52, 152, 219, 0.5)' },
                                { offset: 1, color: 'rgba(52, 152, 219, 0.1)' }
                            ])
                        }
                    },
                    {
                        name: '收银营业收入',
                        type: 'line',
                        smooth: true,
                        data: cashierRevenueData,
                        itemStyle: { color: '#27ae60' },
                        label: {
                            show: true,
                            position: 'top',
                            formatter: function(params) {
                                const value = params.value;
                                if (value >= 10000) {
                                    const num = (value / 10000).toFixed(3);
                                    return '¥' + num + '万';
                                } else {
                                    return '¥' + value.toFixed(3);
                                }
                            },
                            textStyle: {
                                fontSize: 12,
                                color: '#27ae60',
                                fontWeight: 'bold'
                            },
                            distance: 5
                        }
                    },
                    {
                        name: '外卖平台营业收入',
                        type: 'line',
                        smooth: true,
                        data: takeoutRevenueData,
                        itemStyle: { color: '#e67e22' },
                        label: {
                            show: true,
                            position: 'top',
                            formatter: function(params) {
                                const value = params.value;
                                if (value >= 10000) {
                                    const num = (value / 10000).toFixed(3);
                                    return '¥' + num + '万';
                                } else {
                                    return '¥' + value.toFixed(3);
                                }
                            },
                            textStyle: {
                                fontSize: 12,
                                color: '#e67e22',
                                fontWeight: 'bold'
                            },
                            distance: 5
                        }
                    },
                    {
                        name: '利润',
                        type: 'line',
                        smooth: true,
                        data: formattedProfitData,
                        itemStyle: { 
                            color: function(params) {
                                let value = typeof params.value === 'object' ? params.value.value : params.value;
                                return value >= 0 ? '#1abc9c' : '#e74c3c';  // 正值改用青绿色
                            }
                        },
                        lineStyle: {
                            width: 3,
                            type: 'solid'
                        },
                        label: {
                            show: true,
                            position: function(params) {
                                return params.value.value >= 0 ? 'top' : 'bottom';
                            },
                            formatter: function(params) {
                                let value = typeof params.value === 'object' ? params.value.value : params.value;
                                if (Math.abs(value) >= 10000) {
                                    const num = (value / 10000).toFixed(3);
                                    return '¥' + num + '万';
                                } else {
                                    return '¥' + value.toFixed(3);
                                }
                            },
                            textStyle: {
                                fontSize: 12,
                                color: '#00bfff',  // 修改为亮蓝色
                                fontWeight: 'bold'
                            },
                            distance: 5
                        },
                        areaStyle: {
                            color: function(params) {
                                let value = typeof params.value === 'object' ? params.value.value : params.value;
                                return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                                    { 
                                        offset: 0, 
                                        color: value >= 0 ? 'rgba(26, 188, 156, 0.5)' : 'rgba(231, 76, 60, 0.5)' 
                                    },
                                    { 
                                        offset: 1, 
                                        color: value >= 0 ? 'rgba(26, 188, 156, 0.1)' : 'rgba(231, 76, 60, 0.1)' 
                                    }
                                ]);
                            }
                        }
                    }
                ]
            };
            
            this.charts.revenueTrend.setOption(option);
        },
        
        // 渲染成本与营收比例图
        renderCostRevenueRatioChart() {
            if (!this.charts.costRevenueRatio || !this.allData.months) return;
            
            const months = this.allData.months;
            const monthCount = months.length;
            let revenueData = Array(months.length).fill(0);
            let materialCostData = Array(months.length).fill(0);
            let salaryCostData = Array(months.length).fill(0);
            
            // 添加调试日志
            console.log('成本收入比图表 - 所有类别趋势数据:', Object.keys(this.allData.category_trend));
            console.log('成本收入比图表 - 类别分布数据:', this.allData.category_distribution);
            console.log('月份数量:', monthCount);
            
            // 获取"综合营业收入"作为收入数据
            if (this.allData.category_trend["综合营业收入"]) {
                revenueData = this.allData.category_trend["综合营业收入"];
            }
            
            // 获取"物料支出合计"作为物料成本数据
            if (this.allData.category_trend["物料支出合计"]) {
                materialCostData = this.allData.category_trend["物料支出合计"];
                console.log('从 category_trend 找到物料支出合计数据:', materialCostData);
            } else {
                console.warn('未找到物料支出合计数据');
            }
            
            // 从category_distribution中获取人员工资总额
            let totalSalaryCost = 0;
            let monthlyAvgSalary = 0;
            
            if (this.allData.category_distribution) {
                // 从 category_distribution 中获取总人员成本
                const salaryData = this.allData.category_distribution.find(item => item.category === '人员工资');
                if (salaryData) {
                    totalSalaryCost = salaryData.total;
                    console.log('从 category_distribution 找到人员工资总额:', totalSalaryCost);
                }
            }
            
            // 从 category_trend 中获取每月人员工资数据
            if (this.allData.category_trend["人员工资"]) {
                salaryCostData = this.allData.category_trend["人员工资"];
                console.log('从 category_trend 找到每月人员工资数据:', salaryCostData);
                // 计算月平均工资
                monthlyAvgSalary = totalSalaryCost / monthCount;
            }
            
            console.log('月平均工资:', monthlyAvgSalary);
            console.log('工资数据数组:', salaryCostData);
            
            // 计算物料成本占比和人力成本占比
            const materialRatioData = months.map((_, index) => {
                if (revenueData[index] === 0) return 0;
                return (materialCostData[index] / revenueData[index]) * 100;
            });
            
            const salaryRatioData = months.map((_, index) => {
                if (revenueData[index] === 0) return 0;
                return (salaryCostData[index] / revenueData[index]) * 100;
            });
            
            const option = {
                tooltip: {
                    trigger: 'axis',
                    axisPointer: { type: 'shadow' },
                    formatter: function(params) {
                        let result = params[0].name + '<br/>';
                        
                        // 处理柱状图数据
                        for (let i = 0; i < Math.min(3, params.length); i++) {
                            let value = params[i].value;
                            let formattedValue = new Intl.NumberFormat('zh-CN', {
                                style: 'currency',
                                currency: 'CNY',
                                minimumFractionDigits: 1,
                                maximumFractionDigits: 1
                            }).format(value);
                            
                            result += params[i].marker + ' ' + params[i].seriesName + ': ' + formattedValue + '<br/>';
                        }
                        
                        // 处理线图数据（占比）
                        for (let i = 3; i < params.length; i++) {
                            let value = params[i].value;
                            result += params[i].marker + ' ' + params[i].seriesName + ': ' + value.toFixed(1) + '%<br/>';
                        }
                        
                        return result;
                    }
                },
                legend: {
                    data: ['营业收入', '物料支出', '人力支出', '物料占比', '人力占比'],
                    textStyle: { color: '#e8eaef' }
                },
                grid: {
                    left: '3%',
                    right: '4%',
                    bottom: '3%',
                    containLabel: true
                },
                xAxis: {
                    type: 'category',
                    data: months,
                    axisLine: { lineStyle: { color: '#2a3366' } },
                    axisLabel: { color: '#a3a8c3' }
                },
                yAxis: [
                    {
                        type: 'value',
                        name: '金额',
                        axisLine: { lineStyle: { color: '#2a3366' } },
                        axisLabel: { color: '#a3a8c3' },
                        splitLine: { lineStyle: { color: '#1c2755' } }
                    },
                    {
                        type: 'value',
                        name: '占比',
                        min: 0,
                        max: 100,
                        interval: 20,
                        axisLabel: {
                            formatter: '{value}%',
                            color: '#a3a8c3'
                        },
                        axisLine: { lineStyle: { color: '#2a3366' } },
                        splitLine: { show: false }
                    }
                ],
                series: [
                    {
                        name: '营业收入',
                        type: 'bar',
                        data: revenueData,
                        itemStyle: { color: '#3498db' },  // 更柔和的蓝色
                        barWidth: '25%',
                        z: 2,
                        label: {
                            show: true,
                            position: 'top',
                            formatter: function(params) {
                                if (params.value >= 10000) {
                                    return (params.value / 10000).toFixed(1) + '万';
                                }
                                return params.value.toFixed(1);
                            },
                            fontSize: 12,
                            color: '#3498db',  // 匹配柱状图颜色
                            fontWeight: 'bold'
                        }
                    },
                    {
                        name: '物料支出',
                        type: 'bar',
                        data: materialCostData,
                        itemStyle: { color: '#e74c3c' },  // 柔和的红色
                        barWidth: '25%',
                        z: 3,
                        label: {
                            show: true,
                            position: 'top',
                            formatter: function(params) {
                                if (params.value >= 10000) {
                                    return (params.value / 10000).toFixed(1) + '万';
                                }
                                return params.value.toFixed(1);
                            },
                            fontSize: 12,
                            color: '#e74c3c',  // 匹配柱状图颜色
                            fontWeight: 'bold'
                        }
                    },
                    {
                        name: '人力支出',
                        type: 'bar',
                        data: salaryCostData,
                        itemStyle: { color: '#2ecc71' },  // 柔和的绿色
                        barWidth: '25%',
                        z: 4,
                        label: {
                            show: true,
                            position: 'top',
                            formatter: function(params) {
                                if (params.value >= 10000) {
                                    return (params.value / 10000).toFixed(1) + '万';
                                }
                                return params.value.toFixed(1);
                            },
                            fontSize: 12,
                            color: '#2ecc71',  // 匹配柱状图颜色
                            fontWeight: 'bold'
                        }
                    },
                    {
                        name: '物料占比',
                        type: 'line',
                        yAxisIndex: 1,
                        data: materialRatioData,
                        symbol: 'circle',
                        symbolSize: 8,
                        itemStyle: { color: '#e67e22' },  // 柔和的橙色
                        lineStyle: { 
                            width: 3,
                            type: 'solid'
                        },
                        label: {
                            show: true,
                            position: 'top',
                            formatter: function(params) {
                                return params.value.toFixed(1) + '%';
                            },
                            fontSize: 12,
                            color: '#e67e22',  // 匹配线条颜色
                            fontWeight: 'bold',
                            backgroundColor: 'rgba(230, 126, 34, 0.1)',  // 添加半透明背景
                            padding: [2, 4],
                            borderRadius: 2
                        }
                    },
                    {
                        name: '人力占比',
                        type: 'line',
                        yAxisIndex: 1,
                        data: salaryRatioData,
                        symbol: 'diamond',
                        symbolSize: 8,
                        itemStyle: { color: '#8e44ad' },  // 更深的紫色
                        lineStyle: { 
                            width: 3, 
                            type: 'dashed',
                            color: '#8e44ad'  // 保持一致的深紫色
                        },
                        label: {
                            show: true,
                            position: 'top',
                            formatter: function(params) {
                                return params.value.toFixed(1) + '%';
                            },
                            fontSize: 13,  // 增大字体
                            color: '#8e44ad',  // 保持一致的深紫色
                            fontWeight: 'bold',
                            backgroundColor: 'rgba(255, 255, 255, 0.9)',  // 白色背景提高对比度
                            padding: [3, 6],  // 增加内边距
                            borderRadius: 3,  // 圆角边框
                            textBorderColor: 'rgba(255, 255, 255, 0.8)',  // 文字描边
                            textBorderWidth: 2  // 描边宽度
                        }
                    }
                ]
            };
            
            this.charts.costRevenueRatio.setOption(option);
        },
        
        // 渲染类别分布饼图
        renderCategoryDistributionChart() {
            if (!this.charts.categoryDistribution || !this.allData.category_distribution) return;
            
            // 获取原始数据
            const originalCategoryData = this.allData.category_distribution;
            
            console.log('原始类别数据:', originalCategoryData.map(item => item.category));
            
            // 获取总收入数据
            const totalRevenue = originalCategoryData.find(item => item.category === "综合营业收入")?.total || 0;
            const totalRevenueData = this.allData.category_trend["综合营业收入"] || Array(12).fill(0);
            console.log("综合营业收入:", totalRevenue);
            console.log("月度综合营业收入数据:", totalRevenueData);

            // 获取收银收入数据
            const cashierRevenue = originalCategoryData.find(item => item.category === "收银收入")?.total || 0;
            const cashierRevenueData = this.allData.category_trend["收银收入"] || Array(12).fill(0);
            console.log("收银收入:", cashierRevenue);
            console.log("月度收银收入数据:", cashierRevenueData);

            // 获取会员收入数据
            const memberRevenue = originalCategoryData.find(item => item.category === "会员收入")?.total || 0;
            const memberRevenueData = this.allData.category_trend["会员收入"] || Array(12).fill(0);
            console.log("会员收入:", memberRevenue);
            console.log("月度会员收入数据:", memberRevenueData);

            // 获取实际收益数据
            const actualRevenue = originalCategoryData.find(item => item.category === "实际收益")?.total || 0;
            const actualRevenueData = this.allData.category_trend["实际收益"] || Array(12).fill(0);
            console.log("实际收益:", actualRevenue);
            console.log("月度实际收益数据:", actualRevenueData);

            // 获取人员工资数据
            const salaryData = this.allData.category_trend["人员工资"] || Array(12).fill(0);
            const totalSalary = originalCategoryData.find(item => item.category === "人员工资")?.total || 0;
            console.log("人员工资:", totalSalary);
            console.log("月度人员工资数据:", salaryData);

            // 获取物料支出数据
            let totalMaterialCost = 0;
            let monthlyAvgMaterial = 0;
            let materialCostData = Array(12).fill(0);
            
            // 从 category_distribution 中获取物料支出合计总额
            if (this.allData.category_distribution) {
                const materialData = this.allData.category_distribution.find(item => item.category === '物料支出合计');
                if (materialData) {
                    totalMaterialCost = materialData.total;
                    console.log('从 category_distribution 找到物料支出合计总额:', totalMaterialCost);
                }
            }
            
            // 从 category_trend 中获取每月物料支出数据
            if (this.allData.category_trend["物料支出合计"]) {
                materialCostData = this.allData.category_trend["物料支出合计"];
                console.log('从 category_trend 找到每月物料支出数据:', materialCostData);
                monthlyAvgMaterial = totalMaterialCost / 12;
            }
            
            const materialCostPct = (totalMaterialCost / totalRevenue) * 100;
            
            // 获取其他支出数据
            const otherCategories = ["电费", "水费", "固定成本", "其他支出"];
            let totalOtherCost = 0;
            const otherCostData = Array(12).fill(0);
            
            otherCategories.forEach(category => {
                const categoryData = this.allData.category_trend[category] || Array(12).fill(0);
                const categoryTotal = originalCategoryData.find(item => item.category === category)?.total || 0;
                totalOtherCost += categoryTotal;
                for (let i = 0; i < 12; i++) {
                    otherCostData[i] += categoryData[i];
                }
            });
            console.log("其他支出:", totalOtherCost);
            console.log("月度其他支出数据:", otherCostData);
            
            // 准备收入类别数据
            const categoryData = [];
            
            // 添加收银营业收入
            if (cashierRevenue > 0) {
                categoryData.push({
                    category: '收银营业收入',
                    total: cashierRevenue
                });
            }
            
            // 添加会员收入（如果大于0）
            if (memberRevenue > 0) {
                categoryData.push({
                    category: '会员收入',
                    total: memberRevenue
                });
            }
            
            // 添加外卖平台收入
            if (actualRevenue > 0) {
                categoryData.push({
                    category: '外卖平台收入',
                    total: actualRevenue
                });
            }
            
            console.log('最终收入类别数据:', categoryData);
            
            const option = {
                title: {
                    text: '收入类别分布',
                    left: 'center',
                    top: 0,
                    textStyle: {
                        color: '#e8eaef'
                    }
                },
                tooltip: {
                    trigger: 'item',
                    formatter: function(params) {
                        let value = params.value;
                        let formattedValue = new Intl.NumberFormat('zh-CN', {
                            style: 'currency',
                            currency: 'CNY'
                        }).format(value);
                        
                        return params.name + '<br/>' +
                               formattedValue + ' (' + params.percent + '%)';
                    }
                },
                legend: {
                    orient: 'vertical',
                    right: 10,
                    top: 'center',
                    textStyle: { color: '#e8eaef' }
                },
                series: [
                    {
                        name: '收入类别分布',
                        type: 'pie',
                        radius: ['40%', '70%'],
                        center: ['40%', '50%'],
                        avoidLabelOverlap: false,
                        itemStyle: {
                            borderRadius: 10,
                            borderColor: '#0f1630',
                            borderWidth: 2
                        },
                        label: {
                            show: false,
                            position: 'center'
                        },
                        emphasis: {
                            label: {
                                show: true,
                                fontSize: 16,
                                fontWeight: 'bold'
                            }
                        },
                        labelLine: { show: false },
                        data: categoryData.map(item => ({
                            value: item.total,
                            name: item.category
                        }))
                    }
                ]
            };
            
            this.charts.categoryDistribution.setOption(option);
        },
        
        // 渲染增长率图表
        renderGrowthRateChart() {
            if (!this.charts.growthRate || !this.allData.months) return;
            
            const months = this.allData.months;
            const revenueData = this.allData.category_trend["综合营业收入"] || [];
            
            // 计算环比增长率
            const growthRates = [];
            for (let i = 1; i < revenueData.length; i++) {
                const currentRevenue = revenueData[i];
                const previousRevenue = revenueData[i - 1];
                let growthRate = 0;
                
                if (previousRevenue && previousRevenue !== 0) {
                    growthRate = ((currentRevenue - previousRevenue) / previousRevenue) * 100;
                }
                
                growthRates.push({
                    month: months[i],
                    rate: growthRate
                });
            }
            
            console.log('环比增长率数据:', growthRates);
            
            const option = {
                tooltip: {
                    trigger: 'axis',
                    formatter: function(params) {
                        return params[0].name + '<br/>' +
                               params[0].marker + ' 环比增长率: ' + params[0].value.toFixed(2) + '%';
                    }
                },
                grid: {
                    left: '3%',
                    right: '4%',
                    bottom: '3%',
                    containLabel: true
                },
                xAxis: {
                    type: 'category',
                    data: growthRates.map(item => item.month),
                    axisLine: { lineStyle: { color: '#2a3366' } },
                    axisLabel: { color: '#a3a8c3' }
                },
                yAxis: {
                    type: 'value',
                    axisLine: { lineStyle: { color: '#2a3366' } },
                    axisLabel: {
                        formatter: '{value}%',
                        color: '#a3a8c3'
                    },
                    splitLine: { lineStyle: { color: '#1c2755' } }
                },
                series: [
                    {
                        name: '环比增长率',
                        type: 'bar',
                        data: growthRates.map(item => item.rate),
                        itemStyle: {
                            color: function(params) {
                                return params.value >= 0 ? '#2ed573' : '#ff4757';
                            }
                        },
                        label: {
                            show: true,
                            position: function(params) {
                                return params.value >= 0 ? 'top' : 'bottom';
                            },
                            formatter: function(params) {
                                return params.value.toFixed(1) + '%';
                            },
                            color: '#ffffff',
                            fontSize: 14,
                            fontWeight: 'bold',
                            distance: 10,
                            textShadowColor: 'rgba(0, 0, 0, 0.3)',
                            textShadowBlur: 2
                        }
                    }
                ]
            };
            
            this.charts.growthRate.setOption(option);
        },
        
        // 新增：显示每月人员工资数据
        showMonthlySalaryData() {
            if (!this.allData || !this.allData.months || !this.allData.category_trend) return;
            
            const months = this.allData.months;
            console.log('所有月份:', months);
            
            // 获取综合支出数据
            const generalExpenseData = this.allData.category_trend["人员工资"] || Array(months.length).fill(0);
            console.log('每月人员工资数据:');
            months.forEach((month, index) => {
                console.log(`${month}: ¥${generalExpenseData[index].toFixed(2)}`);
            });
            
            // 获取总支出数据
            const totalExpenseData = this.allData.category_trend["人员工资"] || Array(months.length).fill(0);
            console.log('每月总支出数据:');
            months.forEach((month, index) => {
                console.log(`${month}: ¥${totalExpenseData[index].toFixed(2)}`);
            });
        },
        updateSummaryTable() {
            if (!this.allData || !this.allData.months || !this.allData.category_trend) return;
            
            const months = this.allData.months;
            const monthCount = months.length;
            
            // 添加调试日志
            console.log('所有类别趋势数据:', Object.keys(this.allData.category_trend));
            console.log('类别分布数据:', this.allData.category_distribution);
            
            // 1. 首先获取并计算收入数据
            const revenueData = this.allData.category_trend["综合营业收入"] || Array(monthCount).fill(0);
            const totalRevenue = revenueData.reduce((sum, val) => sum + Number(val || 0), 0);
            const avgRevenue = totalRevenue / monthCount;
            const revenuePct = 100; // 收入占收入的比例为100%
            
            // 2. 获取并计算人员工资数据
            let totalSalaryCost = 0;
            let monthlyAvgSalary = 0;
            let salaryCostData = Array(monthCount).fill(0);
            
            if (this.allData.category_distribution) {
                const salaryData = this.allData.category_distribution.find(item => item.category === '人员工资');
                if (salaryData) {
                    totalSalaryCost = salaryData.total;
                    console.log('从 category_distribution 找到人员工资总额:', totalSalaryCost);
                }
            }
            
            if (this.allData.category_trend["人员工资"]) {
                salaryCostData = this.allData.category_trend["人员工资"];
                console.log('从 category_trend 找到每月人员工资数据:', salaryCostData);
                monthlyAvgSalary = totalSalaryCost / monthCount;
            }
            
            const salaryCostPct = (totalSalaryCost / totalRevenue) * 100;
            
            // 3. 获取并计算物料支出数据
            let totalMaterialCost = 0;
            let monthlyAvgMaterial = 0;
            let materialCostData = Array(monthCount).fill(0);
            
            // 从 category_distribution 中获取物料支出合计总额
            if (this.allData.category_distribution) {
                const materialData = this.allData.category_distribution.find(item => item.category === '物料支出合计');
                if (materialData) {
                    totalMaterialCost = materialData.total;
                    console.log('从 category_distribution 找到物料支出合计总额:', totalMaterialCost);
                }
            }
            
            // 从 category_trend 中获取每月物料支出数据
            if (this.allData.category_trend["物料支出合计"]) {
                materialCostData = this.allData.category_trend["物料支出合计"];
                console.log('从 category_trend 找到每月物料支出数据:', materialCostData);
                monthlyAvgMaterial = totalMaterialCost / monthCount;
            }
            
            const materialCostPct = (totalMaterialCost / totalRevenue) * 100;
            
            // 4. 获取并计算综合支出数据
            let totalGeneralExpense = 0;
            if (this.allData.category_distribution) {
                const generalExpenseData = this.allData.category_distribution.find(item => item.category === '综合支出合计');
                if (generalExpenseData) {
                    totalGeneralExpense = generalExpenseData.total;
                    console.log('从 category_distribution 找到综合支出合计:', totalGeneralExpense);
                } else {
                    console.warn('未找到综合支出合计数据');
                }
                
                // 打印完整的 category_distribution 数据，用于调试
                console.log('所有类别分布数据:', this.allData.category_distribution.map(item => ({
                    类别: item.category,
                    总额: item.total
                })));
            }
            
            // 5. 计算其他成本
            const totalOtherCost = totalGeneralExpense - totalSalaryCost;
            console.log('其他成本支出计算:', {
                综合支出合计: totalGeneralExpense,
                人员工资总额: totalSalaryCost,
                其他成本支出: totalOtherCost
            });
            
            const avgOtherCost = totalOtherCost / monthCount;
            const otherCostPct = (totalOtherCost / totalRevenue) * 100;
            
            // 6. 获取并计算利润数据
            const profitData = this.allData.category_trend["利润盈亏"] || Array(monthCount).fill(0);
            const totalProfit = totalRevenue - totalSalaryCost - totalMaterialCost - totalOtherCost;
            const avgProfit = totalProfit / monthCount;
            const profitPct = (totalProfit / totalRevenue) * 100;
            
            // 7. 更新汇总表数据
            this.summaryTableData = [
                {
                    name: '总营业收入',
                    value: totalRevenue,
                    average: avgRevenue,
                    percentage: revenuePct,
                    highlight: true,
                    tooltip: null
                },
                {
                    name: '总人员成本',
                    value: totalSalaryCost,
                    average: monthlyAvgSalary,
                    percentage: salaryCostPct,
                    highlight: false,
                    tooltip: '包含员工工资、社保等人员支出'
                },
                {
                    name: '总物料支出',
                    value: totalMaterialCost,
                    average: monthlyAvgMaterial,
                    percentage: materialCostPct,
                    highlight: false,
                    tooltip: '包含品牌物料、补充物料、其他物料、快驴采购、物流采购等物料支出'
                },
                {
                    name: '其他成本支出',
                    value: totalOtherCost,
                    average: avgOtherCost,
                    percentage: otherCostPct,
                    highlight: false,
                    tooltip: '综合支出合计减去人员工资'
                },
                {
                    name: '总利润/亏损',
                    value: totalProfit,
                    average: avgProfit,
                    percentage: profitPct,
                    highlight: true,
                    tooltip: '总营业收入减去总人员成本、总物料支出和其他成本支出'
                }
            ];

            // 计算同比上月的增长率
            let monthOverMonthRate = 0;
            if (revenueData.length >= 2) {
                const currentMonth = revenueData[revenueData.length - 1];
                const lastMonth = revenueData[revenueData.length - 2];
                if (lastMonth && lastMonth !== 0) {
                    monthOverMonthRate = ((currentMonth - lastMonth) / lastMonth * 100).toFixed(2);
                }
            }

            // 更新同比上月显示
            const monthOverMonthElement = document.querySelector('.month-over-month');
            if (monthOverMonthElement) {
                monthOverMonthElement.textContent = monthOverMonthRate + '%';
                monthOverMonthElement.style.color = monthOverMonthRate >= 0 ? '#2ed573' : '#ff4757';
            }
        }
    },
    mounted() {
        // 初始化时间并设置定时更新
        this.updateTime();
        setInterval(this.updateTime, 1000);
        
        // 加载数据并渲染图表
        this.loadAllData();
    }
});

// 挂载Vue应用
app.mount('#app'); 