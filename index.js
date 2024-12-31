
(async () => {
    // 导入所需模块
    const fetch = (await import('node-fetch')).default;
    const chalk = (await import('chalk')).default;
    const fs = require('fs').promises;
    
    const CONFIG = {
      BASE_URL: "https://miniapp.uxuy.one/rpc",
      SLEEP_INTERVAL: 12 * 60 * 60 * 1000,
      TOKEN_FILE: "token.txt",
    };

    // 请求头模板
    let headers = {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json; charset=utf-8',
        'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        'x-csrf-token':'{{x-csrf-token}}'
    };

    // 读取令牌
    async function readTokens() {
        try {
            // 读取 token 文件
            const tokenData = await fs.readFile(CONFIG.TOKEN_FILE, 'utf-8');
            const tokens = tokenData.split('\n').filter(line => line.trim());

            return tokens;
        } catch (err) {
            console.error("读取 token 文件失败:", err.message);
            return [];
        }
    }

    async function getId(){
            return Math.floor(Math.random() * 900000000) + 100000000;
    }

    // coday 函数，用于发送 HTTP 请求
    async function coday(url, method, payloadData = null, headers = headers) {
        try {
            const options = {
                method,
                headers,
                body: payloadData ? JSON.stringify(payloadData) : null
            };
            const response = await fetch(url, options);
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            return await response.json();
        } catch (error) {
            return null;
        }
    }

    async function uxuyInfo(headers) {
        const payload = {method: "wallet_myPoint", params: [], id: await getId(), jsonrpc: "2.0"};
        const myPointInfo = await coday(`${CONFIG.BASE_URL}`, 'POST', payload, headers);
        if (myPointInfo && myPointInfo.result){
            const {id,groupId, finished,token} = myPointInfo.result.farm;
            console.log(chalk.blue(`UXUY Point: ${Math.floor(token.balance/1000)}`));
            if (finished)
                return {id, groupId};
        } else {
            console.error(chalk.red(`获取用户信息失败`));
        }
        return null;
    }


    async function claim(headers, params) {
        const payload = {method: "wallet_claimFarm", params: params, id: await getId(), jsonrpc: "2.0"};
        const reward = await coday(`${CONFIG.BASE_URL}`, 'POST', payload, headers);
        if (reward && reward.result){
            console.log(chalk.blue(`获取奖励 ${reward.result.amount}`));
        } else {
            console.error(chalk.red(`获取奖励失败`));
        }
    }

    async function claimTasks(headers, task) {
        let payload = {method: "wallet_adsClick", params: [task.taskId], id: await getId(), jsonrpc: "2.0"};
        await coday(`${CONFIG.BASE_URL}`, 'POST', payload, headers);
        payload = {method: "wallet_adsClaim", params: [task.taskId,""], id: await getId(), jsonrpc: "2.0"};
        const adsClaim = await coday(`${CONFIG.BASE_URL}`, 'POST', payload, headers);
        if (adsClaim && adsClaim.result){
            const {id, rewarded, awardAmount} = adsClaim.result;

            if (rewarded){
                console.info(`任务 ${id} 领取奖励 ${awardAmount} UP`);
            } else {
                console.error(`任务 ${id} 领取奖励失败`);
            }
        }
    }

    async function handleAdsTask(headers) {
        const payload = {method: "wallet_adsList2", params: [false], id: await getId(), jsonrpc: "2.0"};
        const adsList2 = await coday(`${CONFIG.BASE_URL}`, 'POST', payload, headers);
        const unclaimedTasks = [];
        if (adsList2 && adsList2.result){
            adsList2.result.items.forEach(item => {
                const {id, finished, awardAmount} = item;
                if (!finished) {
                    unclaimedTasks.push({ taskId: id, awardAmount: awardAmount });
                }
            })

            console.info(`待领取任务个数: ${unclaimedTasks.length}`);
            for (const task of unclaimedTasks) {
                console.info(`领取奖励: ${task.taskId}`);
                await claimTasks(headers, task);
            }
        }
    }

    // 单个账户的主要处理流程
    async function processAccount(access_token, accountIndex) {
        headers = {
            ...headers,
            Authorization: `Bearer ${access_token}`,
        };

        let ids;
        if (ids = await uxuyInfo(headers)) {
            claim(headers,[ids.groupId, ids.id, ""]);
        }
        await handleAdsTask(headers);
    }

    // 主函数
    async function main() {
        while (true) {
            const accounts = await readTokens();

            if (accounts.length === 0) {
                console.error("没有账户可处理。");
                return;
            }

            for (let i = 0; i < accounts.length; i++) {
                const account = accounts[i];
                console.info(`正在处理账户 ${i + 1}...`);
                await processAccount(account, i);
            }
            await new Promise(resolve => setTimeout(resolve, 5*60000+Math.floor(Math.random()*1000))); // 每 5min 运行一次
        }
    }

    main();
})();
