/**
 * PocketSeek 品牌标记：品牌蓝圆角方块 + 白色口袋 + 开口弧线 + AI 星芒。
 * 与 design/icon-any.svg、PWA/Android 图标使用同一套几何母版。
 */
export const BrandMark = ({
  size = 32,
  className,
  title,
}: {
  size?: number
  className?: string
  /** 提供时作为图片朗读；页面已有品牌名时省略，标记作为装饰 */
  title?: string
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 512 512"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    role={title ? 'img' : undefined}
    aria-label={title}
    aria-hidden={title ? undefined : true}
    focusable="false"
    shapeRendering="geometricPrecision"
  >
    <rect width="512" height="512" rx="116" fill="#3A63F2" />
    <path
      d="M156 250H356Q390 250 390 284V344C390 402 338 438 272 438C206 438 122 402 122 344V284Q122 250 156 250Z"
      fill="#FFFFFF"
    />
    <path
      d="M142 286C188 326 324 326 370 286"
      fill="none"
      stroke="#3A63F2"
      strokeWidth="16"
      strokeLinecap="round"
    />
    <path
      d="M256 78C264 120 278 134 320 146C278 158 264 172 256 214C248 172 234 158 192 146C234 134 248 120 256 78Z"
      fill="#FFFFFF"
    />
  </svg>
)
