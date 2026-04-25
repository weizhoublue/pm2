<div align="center">
 <br/>

![https://raw.githubusercontent.com/Unitech/pm2/master/pres/pm2-logo-2.png](https://raw.githubusercontent.com/Unitech/pm2/master/pres/pm2-logo-2.png)

<b>P</b>(rocess) <b>M</b>(anager) <b>2</b><br/>
  <i>Runtime Edition</i>
<br/><br/>


<a title="PM2 Downloads" href="https://npm-stat.com/charts.html?package=pm2&from=2018-01-01&to=2023-08-01">
  <img src="https://img.shields.io/npm/dm/pm2" alt="Downloads per Month"/>
</a>

<a title="PM2 Downloads" href="https://npm-stat.com/charts.html?package=pm2&from=2018-01-01&to=2023-08-01">
  <img src="https://img.shields.io/npm/dy/pm2" alt="Downloads per Year"/>
</a>

<a href="https://badge.fury.io/js/pm2" title="NPM Version Badge">
   <img src="https://badge.fury.io/js/pm2.svg" alt="npm version">
</a>

<br/>
<br/>
<br/>
</div>


PM2 is a production process manager for Node.js/Bun applications with a built-in load balancer. It allows you to keep applications alive forever, to reload them without downtime and to facilitate common system admin tasks.

Starting an application in production mode is as easy as:

```bash
$ pm2 start app.js
```

PM2 is constantly assailed by [more than 1800 tests](https://github.com/Unitech/pm2/actions/workflows/node.js.yml).

Official website: [https://pm2.keymetrics.io/](https://pm2.keymetrics.io/)

Works on Linux (stable) & macOS (stable) & Windows (stable). All Node.js versions are supported starting Node.js 12.X and Bun since v1


## get-started


```shell

#-------- 安装 -----------

从 发版下载 二进制
https://github.com/weizhoublue/pm2/releases

mv pm2-macos-x64  pm2
chmod +x pm2
sudo rm -f /usr/local/bin/pm2
sudo mv pm2 /usr/local/bin/pm2


# 如果以前运行过，会有后台进程，要杀掉，否则一直会以老的逻辑来运行
pm2 kill

# 每次提交任务后， 都会保存在  ~/.pm2/dump.pm2  ，以确保 重启后 能够加载这些数据  继续运行
pm2 set pm2:autodump true

# 每次主机重启，都自动运行后台 daemon，以确保我们的 cron 任务自动运行
# 需要以 root 运行如下命令，注册系统的启动服务
sudo pm2 startup
# sudo pm2 unstartup 




#---------------- 一次性运行任务 -------

# 删除
pm2 delete test

# 运行一个一次性任务
# 注意， 命令行参数一定要在整个命令的 最后， 否则 会把 其他 pm2 的参数 传递给脚本 
# --no-autorestart  如果进程退出了，不会强制拉起他（不要求他一直在跑）
export ENV_1=test
pm2 start \
   --name "test" \
   --time \
   --no-autorestart \
   /tmp/test.sh -- "arg_1_test" "arg2 test" "arg 3 test"


# 触发任务立即 再运行一次
pm2 restart test

# 获取任务列表
pm2 list

# 一直监控日志 ， 默认输出最近的 15 行
# 如果用相同的 任务 name  反复创建相同的工作， 会看到 以前所有的 日志
# 日志文件存在：
#   - ~/.pm2/logs/<task_name>-out.log  
#   - ~/.pm2/logs/<task_name>-error.log  
pm2 log test
pm2 log test  --lines 1000


# 立刻出发运行一次
pm2 restart test


 

#------------------- cron 周期启动任务  ---------

# 删除
pm2 delete cron_test

# 注意， 命令行参数一定要在整个命令的 最后， 否则 会把 其他 pm2 的参数 传递给脚本 
export ENV_1=test1
export ENV_2=test2
pm2 start \
    --name "cron_test"   \
    --time \
    --cron "*/1 * * * *" \
    --no-autorestart \
    /tmp/test.sh -- "arg_1_test" "arg2 test" "arg3 test"

# 立刻触发 运行一次 来测试
pm2 restart test


# 每5分钟
--cron "*/5 * * * *"

# 每天凌晨3点
--cron "0 3 * * *"

# 每周一早上9点
--cron "0 9 * * 1"

# 每月1号凌晨0点
--cron "0 0 1 * *"



```



```shell
#----------- 测试脚本 ---------------
cat <<'EOF' >/tmp/test.sh
#!/bin/bash

echo "$(date)=== 传入的参数 (共 $# 个) ==="

if [ $# -eq 0 ]; then
    echo "当前没有传入任何参数。"
else
    # $@ 代表所有的入参列表
    count=1
    for arg in "$@"; do
        echo "参数 $count: $arg"
        count=$((count + 1))
    done
fi

echo ""
echo "=== 带有 ENV_ 前缀的环境变量 ==="
env | grep "^ENV_" || echo "未找到带有 ENV_ 前缀的环境变量。"
EOF

```


## Installing PM2

### With NPM

```bash
$ npm install pm2 -g
```

### With Bun

```bash
$ bun install pm2 -g
```
**Please note that you might need to symlink node to bun if you only want to use bun via `sudo ln -s /home/$USER/.bun/bin/bun /usr/bin/node`**

___

You can install Node.js easily with [NVM](https://github.com/nvm-sh/nvm#installing-and-updating) or [FNM](https://github.com/Schniz/fnm) or install Bun with `curl -fsSL https://bun.sh/install | bash`

### Start an application

You can start any application (Node.js, Bun, and also Python, Ruby, binaries in $PATH...) like that:

```bash
$ pm2 start app.js
```

Your app is now daemonized, monitored and kept alive forever.

### Managing Applications

Once applications are started you can manage them easily:

![Process listing](https://github.com/Unitech/pm2/raw/master/pres/pm2-ls-v2.png)

To list all running applications:

```bash
$ pm2 list
```

Managing apps is straightforward:

```bash
$ pm2 stop     <app_name|namespace|id|'all'|json_conf>
$ pm2 restart  <app_name|namespace|id|'all'|json_conf>
$ pm2 delete   <app_name|namespace|id|'all'|json_conf>
```

To have more details on a specific application:

```bash
$ pm2 describe <id|app_name>
```

To monitor logs, custom metrics, application information:

```bash
$ pm2 monit
```

[More about Process Management](https://pm2.keymetrics.io/docs/usage/process-management/)

### Cluster Mode: Node.js Load Balancing & Zero Downtime Reload

The Cluster mode is a special mode when starting a Node.js application, it starts multiple processes and load-balance HTTP/TCP/UDP queries between them. This increase overall performance (by a factor of x10 on 16 cores machines) and reliability (faster socket re-balancing in case of unhandled errors).

![Framework supported](https://raw.githubusercontent.com/Unitech/PM2/master/pres/cluster.png)

Starting a Node.js application in cluster mode that will leverage all CPUs available:

```bash
$ pm2 start api.js -i <processes>
```

`<processes>` can be `'max'`, `-1` (all cpu minus 1) or a specified number of instances to start.

**Zero Downtime Reload**

Hot Reload allows to update an application without any downtime:

```bash
$ pm2 reload all
```

[More informations about how PM2 make clustering easy](https://pm2.keymetrics.io/docs/usage/cluster-mode/)

### Container Support

With the drop-in replacement command for `node`, called `pm2-runtime`, run your Node.js application in a hardened production environment.
Using it is seamless:

```
RUN npm install pm2 -g
CMD [ "pm2-runtime", "npm", "--", "start" ]
```

[Read More about the dedicated integration](https://pm2.keymetrics.io/docs/usage/docker-pm2-nodejs/)

### Host monitoring speedbar

PM2 allows to monitor your host/server vitals with a monitoring speedbar.

To enable host monitoring:

```bash
$ pm2 set pm2:sysmonit true
$ pm2 update
```

![Framework supported](https://raw.githubusercontent.com/Unitech/PM2/master/pres/vitals.png)

### Terminal Based Monitoring

![Monit](https://github.com/Unitech/pm2/raw/master/pres/pm2-monit.png)

Monitor all processes launched straight from the command line:

```bash
$ pm2 monit
```

### Log Management

To consult logs just type the command:

```bash
$ pm2 logs
```

Standard, Raw, JSON and formated output are available.

Examples:

```bash
$ pm2 logs APP-NAME       # Display APP-NAME logs
$ pm2 logs --json         # JSON output
$ pm2 logs --format       # Formated output

$ pm2 flush               # Flush all logs
$ pm2 reloadLogs          # Reload all logs
```

To enable log rotation install the following module

```bash
$ pm2 install pm2-logrotate
```

[More about log management](https://pm2.keymetrics.io/docs/usage/log-management/)

### Startup Scripts Generation

PM2 can generate and configure a Startup Script to keep PM2 and your processes alive at every server restart.

Init Systems Supported: **systemd**, **upstart**, **launchd**, **rc.d**

```bash
# Generate Startup Script
$ pm2 startup

# Freeze your process list across server restart
$ pm2 save

# Remove Startup Script
$ pm2 unstartup
```

[More about Startup Scripts Generation](https://pm2.keymetrics.io/docs/usage/startup/)

### Updating PM2

```bash
# Install latest PM2 version
$ npm install pm2@latest -g
# Save process list, exit old PM2 & restore all processes
$ pm2 update
```

*PM2 updates are seamless*

## PM2+ Monitoring

If you manage your apps with PM2, PM2+ makes it easy to monitor and manage apps across servers.

![https://app.pm2.io/](https://pm2.io/img/app-overview.png)

Feel free to try it:

[Discover the monitoring dashboard for PM2](https://app.pm2.io/)

Thanks in advance and we hope that you like PM2!

## CHANGELOG

[CHANGELOG](https://github.com/Unitech/PM2/blob/master/CHANGELOG.md)

## Contributors

[Contributors](http://pm2.keymetrics.io/hall-of-fame/)

## License

PM2 is made available under the terms of the GNU Affero General Public License 3.0 (AGPL 3.0).
For other licenses [contact us](mailto:contact@keymetrics.io).
