import type { Metadata } from "next";
import AccountClient from "./AccountClient";

export const metadata: Metadata = {
  title: "我的牌組｜Hololive OCG 繁中卡庫・牌組工房",
  description: "登入、查看及管理個人 Hololive OCG 牌組。",
};

export default function AccountPage() {
  return <AccountClient />;
}
