# Android APK 构建说明（本地、离线友好）

本工程用 [Capacitor 8](https://capacitorjs.com/) 把 `dist/` 的 Web 产物打进原生 Android 壳。
本机没有 Android Studio，也不需要 —— 工具链是自建的，全部走国内镜像。

## 目标产物

| 产物 | 路径 | 说明 |
| --- | --- | --- |
| Release APK（已签名） | `android/app/build/outputs/apk/release/app-release.apk` | 可直接侧载安装，推荐 |
| Debug APK | `android/app/build/outputs/apk/debug/app-debug.apk` | 调试用，包名相同但签名不同 |

- 包名：`com.pocketseek.app`
- minSdk 24（Android 7.0+）/ targetSdk 36 / compileSdk 36
- 版本：`versionCode 12` / `versionName 0.6.3`（改 `android/app/build.gradle`）
- 签名：自签 keystore `android/app/pocketseek-release.jks`（**不入库**）。构建 release 前必须设置
  `POCKETSEEK_KEYSTORE_PASSWORD` / `POCKETSEEK_KEY_PASSWORD`，构建脚本不再提供默认口令
- **0.6.3 签名更换**：旧 keystore 口令丢失且无法恢复，0.6.3 使用新生成的密钥；旧文件备份在
  `android/app/pocketseek-release.jks.old-20261122`。新签名的 APK 不能覆盖 ≤0.6.2
  （需先在旧版导出历史 → 卸载 → 安装 → 导入）。新证书 SHA-256：
  `84d17619b2d27e85dd061f42d0d2c1b2bc07dd2900cc2d9adbda499a1204f66b`
- 口令只保存在项目根目录 `.env.release.local`（已被 `.gitignore` 的 `.env.*` 覆盖，不会入库）；
  请连同 keystore 一起备份

## 工具链（本机已装好，可复现）

| 组件 | 版本 | 安装位置 | 来源 |
| --- | --- | --- | --- |
| JDK | Temurin 21.0.13 | `.tools/jdk21/` | 清华 Adoptium 镜像 |
| Android SDK | platform 36 / build-tools 36.0.0 / platform-tools 37.0.3 | `.android-sdk/` | 腾讯云 AndroidSDK 镜像 |
| Gradle | 8.14.3 | 由 wrapper 自动下载 | 腾讯云 gradle 镜像 |
| AGP | 8.13.0 | Gradle 依赖 | 阿里云 google Maven 镜像 |

> Capacitor 8 要求 **JDK 21**（`:capacitor-android` 以 Java 21 编译）；JDK 17 会在编译期报
> “无效的源发行版：21”。这是本项目踩过的坑。

`.android-sdk`、`.tools`、keystore、`android/local.properties` 都已 gitignore。

## 构建步骤

> `pnpm build` 走 `scripts/build.mjs`：内部设置 `NODE_ENV=production` 并清理 `dist/`，
> Windows 的 cmd / PowerShell 与 Git Bash 都可直接执行。

```sh
# 0) 本机口令写在项目根目录 .env.release.local 时，先载入环境变量
set -a; . ./.env.release.local; set +a

# 1) 构建 Web 产物并同步进 Android 工程
pnpm build
npx cap sync android

# 2) 编译（Windows Git Bash / MSYS 环境）
cd android
export JAVA_HOME="D:/DeepSeekApp/.tools/jdk21"
export PATH="$JAVA_HOME/bin:$PATH"
export POCKETSEEK_KEYSTORE_PASSWORD="<keystore 口令>"
export POCKETSEEK_KEY_PASSWORD="<key 口令>"
./gradlew assembleRelease      # 或 assembleDebug（Debug 不需要口令）
```

`android/local.properties` 指向自建 SDK：

```properties
sdk.dir=D:/DeepSeekApp/.android-sdk
```

## 已做的镜像适配

- `android/gradle/wrapper/gradle-wrapper.properties`：`distributionUrl` 改到腾讯云 gradle 镜像
  （官方 `services.gradle.org` 本机不可达）。
- `android/build.gradle`：`repositories` 优先阿里云 `google` / `public` / `gradle-plugin` 镜像，
  官方仓库兜底。
- SDK 组件直接下载 zip 手工组装（跳过 `sdkmanager`，因此无需接受许可协议交互）：
  - `platforms/android-36`、`platforms/android-35`
  - `build-tools/36.0.0`、`build-tools/35.0.0`
  - `platform-tools`
  镜像地址：`https://mirrors.cloud.tencent.com/AndroidSDK/<文件名>`，
  清单：`https://mirrors.cloud.tencent.com/AndroidSDK/repository2-3.xml`

## 与原工程的映射关系

- `capacitor.config.ts`：`webDir: 'dist'`，`androidScheme: 'https'`
  —— WebView 里是安全上下文，localStorage / 摄像头 / 录音 / 文件选择器行为与浏览器一致。
- 原生壳内不注册 Service Worker（`src/pwa.ts` 里检测 `window.Capacitor`），避免缓存导致升级后加载旧资源。
- Manifest 额外声明 `RECORD_AUDIO` / `MODIFY_AUDIO_SETTINGS`，供语音输入使用。
- `@capacitor/filesystem` + `@capacitor/share`（0.2.0 新增）：会话 Markdown 导出写入缓存文件后调起系统分享面板；
  WebView 不支持浏览器式 blob 下载与 Web Share，因此原生壳内必须走这两个插件。无额外运行时权限。
- 图标与启动图由 `design/make_android_assets.py` 从「口袋 + 星芒」矢量母版生成；
  `ic_launcher_foreground.png` 同时作为自适应图标前景与 Android 13 单色主题图标的 alpha 蒙版。
- 窗口底色：`android/app/src/main/java/com/pocketseek/app/ThemeBackgroundPlugin.java` 由 `src/native.ts` 调用，
  手动切换深浅主题时同步状态栏 / 手势栏背后的窗口底色（Android 15+ 的 `setStatusBarColor` 已不生效，改为设置 window background）。
- 系统分享入口（0.5.0）：`AndroidManifest.xml` 为 `MainActivity` 声明 `ACTION_SEND` / `ACTION_SEND_MULTIPLE`
  （`text/plain`、`image/*`），`MainActivity.java` 在冷启动与 `onNewIntent` 时把内容登记到
  `ShareReceiverPlugin.java`；JS 调用 `ShareReceiver.getPending()` 取走文本与图片 base64 后并入草稿。
  Web 端对应 `public/manifest.webmanifest` 的 `share_target`（只支持文本/链接）。
- 修改品牌标记后（需要 Python + Pillow）：
  ```sh
  python design/make_icons.py           # public/ PWA、favicon、Apple touch
  python design/make_android_assets.py  # Android mipmap + splash
  ```

## 升级 App 的流程

```sh
# 改 versionName / versionCode 后
pnpm build && npx cap sync android
cd android && export JAVA_HOME="D:/DeepSeekApp/.tools/jdk21" && ./gradlew assembleRelease
# 重新侧载；0.6.3 起包名与签名不变即可覆盖安装，数据保留
# 注意：≤0.6.2 → 0.6.3 因更换签名，需先导出历史、卸载旧版再安装
```
