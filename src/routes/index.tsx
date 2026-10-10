import { createFileRoute } from "@tanstack/react-router";
import { Chatdunia } from "@/components/chatdunia/Chatdunia";

export const Route = createFileRoute("/")({
 head: () => ({ meta: [
  { title: "Chatdunia — Chati na Wazungu Ulipwe Papo Hapo" },
  { name: "description", content: "Chatdunia inakuwezesha kuchati na wageni kutoka nje ya nchi na kulipwa hadi TZS 150,000 kwa mazungumzo." },
  { property: "og:title", content: "Chatdunia — Chati Ulipwe Papo Hapo" },
  { property: "og:description", content: "Chagua mzungu, chati kwa dakika chache, na malipo yaingie kwenye salio lako." },
  { property: "og:type", content: "website" },
  { name: "twitter:card", content: "summary_large_image" },
 ] }),
 component: Chatdunia,
});
