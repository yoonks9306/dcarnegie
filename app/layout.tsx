import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {title:"데일 카네기 코칭",description:"매일 두 가지 원칙을 읽고 하루를 돌아보는 공간.",icons:{icon:"/favicon.svg",shortcut:"/favicon.svg"}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ko"><body>{children}</body></html>}
