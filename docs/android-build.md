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
- 版本：`versionName 0.1.0`（改 `android/app/build.gradle`）
- 签名：自签 keystore `android/app/pocketseek-release.jks`（**不入库**，密码默认 `pocketseek2026`，可用
  `POCKETSEEK_KEYSTORE_PASSWORD` / `POCKETSEEK_KEY_PASSWORD` 覆盖）

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

```sh
# 1) 构建 Web 产物并同步进 Android 工程
pnpm build
npx cap sync android

# 2) 编译（Windows Git Bash / MSYS 环境）
cd android
export JAVA_HOME="D:/DeepSeekApp/.tools/jdk21"
export PATH="$JAVA_HOME/bin:$PATH"
./gradlew assembleRelease      # 或 assembleDebug
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
- 图标与启动图由 `design/make_android_assets.py` 从矢量 logo 生成（蓝底白问号）。

## 升级 App 的流程

```sh
# 改 versionName / versionCode 后
pnpm build && npx cap sync android
cd android && export JAVA_HOME="D:/DeepSeekApp/.tools/jdk21" && ./gradlew assembleRelease
# 重新侧载；包名不变、签名不变即可覆盖安装，数据保留
```
