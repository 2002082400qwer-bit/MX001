type ErrorNoticeProps = { message: string }

/** 将内容加载或会话创建错误以可访问的警告信息展示给用户。 */
export function ErrorNotice({ message }: ErrorNoticeProps) { return <p role="alert">{message}</p> }
