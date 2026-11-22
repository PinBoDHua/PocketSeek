import { registerHooks } from 'node:module'

// 源码沿用 rspack 的 extensionAlias：用 .js 后缀引用同名 .ts/.tsx。
// Node 测试运行时把相对 .js 引用映射回 .ts/.tsx，与构建解析顺序一致。
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      (specifier.startsWith('./') || specifier.startsWith('../')) &&
      specifier.endsWith('.js')
    ) {
      const base = specifier.slice(0, -3)
      for (const ext of ['.ts', '.tsx']) {
        try {
          return nextResolve(base + ext, context)
        } catch {
          // 尝试下一个后缀
        }
      }
    }
    return nextResolve(specifier, context)
  },
})