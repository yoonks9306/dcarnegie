import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {title:"D. Carnegie — Daily Practice",description:"기록을 브라우저에만 보관하는 데일 카네기 실천 노트.",icons:{icon:"/favicon.svg",shortcut:"/favicon.svg"}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ko"><body>{children}</body></html>}
