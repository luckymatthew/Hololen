import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./studio.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export async function generateMetadata(): Promise<Metadata> {
  const metadataBase = new URL("https://hololive-ocg-zh-deck-studio.matthewmelia.chatgpt.site");

  return {
    metadataBase,
    title: "Hololive OCG 繁中卡庫・牌組工房",
    description: "搜尋 Hololive OCG 全卡庫、閱讀繁體中文技能、建立牌組，並用私人房間碼與朋友進行 PvP 試牌。",
    openGraph: {
      title: "Hololive OCG 繁中卡庫・牌組工房",
      description: "1,276 張卡、繁體中文技能、牌組構築及私人 PvP 模擬器；已收錄《サマー・ホログラム》完整 214 種版本。",
      type: "website",
      locale: "zh_TW",
    },
    twitter: {
      card: "summary",
      title: "Hololive OCG 繁中卡庫・牌組工房",
      description: "搜尋卡片、讀繁中技能、組成 71 張牌組並與朋友私人試牌。",
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{const t=localStorage.getItem('hololive-ocg-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch{}` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
