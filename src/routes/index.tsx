import { createFileRoute } from "@tanstack/react-router";
import { Chatdunia } from "@/components/chatdunia/Chatdunia";

export const Route = createFileRoute("/")({
 head: () => ({ links: [{ rel: "canonical", href: "https://chatdunialive.site/" }], meta: [
  { title: "Chatdunia — Chati na Wazungu Ulipwe Papo Hapo" },
  { name: "description", content: "Chatdunia Live (chatdunialive) ni jukwaa la kuchati na wageni kutoka nje ya nchi. Tembelea chatdunialive.site na ujue huduma za Chatdunia." },
  { name: "keywords", content: "chatdunialive, chatdunia.live, chatdunia, Chatdunia Live, chatdunialive.site, kuchati na wageni, chat na kulipwa" },
  { name: "robots", content: "index, follow, max-image-preview:large" },
  { property: "og:title", content: "Chatdunia — Chati Ulipwe Papo Hapo" },
  { property: "og:description", content: "Chagua mzungu, chati kwa dakika chache, na malipo yaingie kwenye salio lako." },
  { property: "og:type", content: "website" },
  { property: "og:url", content: "https://chatdunialive.site/" },
  { property: "og:site_name", content: "Chatdunia" },
  { name: "twitter:card", content: "summary_large_image" },
 ] }),
 component: () => <Chatdunia/>,
});
