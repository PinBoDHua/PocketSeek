import styles from './EmptyArt.module.css'

/**
 * 空态线条插画：只用单色描边的口袋 + 问号，和 App 图标同源但不重复色块。
 * 纯装饰，aria-hidden；不参与点击。
 */
export const EmptyArt = () => (
  <div className={styles.art} aria-hidden>
    <svg viewBox="0 0 96 96" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect
        x="3"
        y="3"
        width="90"
        height="90"
        rx="24"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M35 41c0-13 26-13 26 0 0 9-12 8-12 18"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="44" y="66" width="8" height="8" rx="2.6" fill="currentColor" />
    </svg>
  </div>
)
