# assets/ —— 图片素材（v1.1 新增）

| 文件 | 用途 | 说明 |
|---|---|---|
| `og.png` | 分享卡片（Open Graph，1200×630） | 微信/QQ/社交平台分享时显示；index.html 与详情页的 `og:image` 指向它的线上完整地址 |
| `hero.jpg`（未放） | 首页主视觉 | 放入后，把 index.html 中 `#heroVisual` 的 `data-src` 改为 `assets/hero.jpg`；留空则不显示 |
| `photos/*.jpg` | 详情页主图（v1.2 已放 4 张，来自 Wikimedia Commons） | 在 `js/data/nodes.js` 的 details 条目里写 `photo: { src: 'photos/rucheng.jpg', caption, credit, license, licenseUrl, sourceUrl }`；图注如实说明拍的是什么（替代图要写明） |

⚠️ 只放**有版权依据**的图片（自摄、已获授权、或 CC 等开放许可），并在 `photo` 的 credit / license / sourceUrl 中如实写明。
