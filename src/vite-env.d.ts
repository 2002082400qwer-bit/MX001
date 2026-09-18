/** 声明 Vite 对样式副作用导入的类型支持。 */
declare module '*.css'

/** 声明 Vite 对内置 SVG 静态资源导入的类型支持。 */
declare module '*.svg' {
  const source: string
  export default source
}
