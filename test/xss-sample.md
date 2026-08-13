# XSS 对抗验收样本

本文件用于 md-reader 安全验收：以下所有载荷渲染后都必须**不执行**、不产生可点击的危险链接。

## 1. 直接脚本注入

<script>alert('xss-1')</script>

<img src=x onerror="alert('xss-2')">

## 2. 危险协议链接

[点我](javascript:alert('xss-3'))

[data协议](data:text/html,<script>alert('xss-4')</script>)

![图片](javascript:alert('xss-5'))

[vbscript](vbscript:msgbox)

## 3. 属性逃逸尝试

[正常文字]("onmouseover="alert('xss-6'))

**加粗里带 <b onclick="alert('xss-7')">标签</b>**

## 4. 代码块里的载荷（应原样展示）

```html
<script>alert('code-block-safe')</script>
```

行内代码：`<script>alert('inline-safe')</script>`

## 5. 表格里的载荷

| 列A | 列B |
|---|---|
| <script>alert('xss-8')</script> | [j](javascript:alert('xss-9')) |

## 6. 合法链接（应正常可点）

[GitHub](https://github.com) 与 [锚点](#1-直接脚本注入) 与 `mailto:` 类。

## 7. 协议伪装（Unicode / 实体 / 百分号）

以下渲染后不得出现可点击的 javascript:/data:/vbscript: 链接或图片。

[zwsp](​javascript:alert('xss-zwsp'))

[entity-colon](javascript&colon;alert('xss-colon'))

[entity-decimal](javascript&#58;alert('xss-dec'))

[pct-colon](javascript%3Aalert('xss-pct'))

[proto-relative](//example.invalid/xss)
