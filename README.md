给主包的小程序（实验版）# L03
应该生日的时候会收到
目前是2026年4月26日

## 运行方式

1. 如果只是本地打开，可以直接双击 `index.html` 或 `message.html`。
2. 如果要做真正的跨设备同步，推荐用 Supabase。

## 同步说明

留言和最近删除现在支持两种模式：

1. `sync-config.js` 里填写 Supabase 的 `supabaseUrl` 和 `supabaseAnonKey` 后，所有设备访问同一个网页都会读写同一份公共数据。
2. 如果不填配置，页面会回退到浏览器本地存储，仍可离线使用，但不能跨设备同步。

## Supabase 建表

把 [supabase-schema.sql](supabase-schema.sql) 里的 SQL 执行到你的 Supabase 项目，然后在 [sync-config.js](sync-config.js) 中填入你的项目地址和 anon key。
