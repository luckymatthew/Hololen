import type { Metadata } from "next";
import SimulatorClient from "./SimulatorClient";

export const metadata: Metadata = {
  title: "私人 PvP 對戰模擬器｜Hololive OCG 繁中卡庫",
  description: "建立私人房間、分享 6 位房間碼，使用自己的 Hololive OCG 牌組與朋友即時測試。",
};

export default function SimulatorPage() {
  return <SimulatorClient />;
}
