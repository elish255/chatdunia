import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Chatdunia } from "@/components/chatdunia/Chatdunia";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
 head: () => ({ meta: [
  { title: "Chatdunia — Chati na Wazungu Ulipwe Papo Hapo" },
  { name: "description", content: "Chatdunia inakuwezesha kuchati na wageni kutoka nje ya nchi na kulipwa hadi TZS 150,000 kwa mazungumzo." },
  { property: "og:title", content: "Chatdunia — Chati Ulipwe Papo Hapo" },
  { property: "og:description", content: "Chagua mzungu, chati kwa dakika chache, na malipo yaingie kwenye salio lako." },
  { property: "og:type", content: "website" },
  { name: "twitter:card", content: "summary_large_image" },
 ] }),
 component: HomeGate,
});
function HomeGate(){const [checking,setChecking]=useState(true);const [blocked,setBlocked]=useState("");const navigate=useNavigate();useEffect(()=>{let live=true;void(async()=>{try{const {data:{user}}=await supabase.auth.getUser();if(!user){if(live)setChecking(false);return;}const {data,error}=await supabase.from("chatdunia_users").select("account_status,activation_paid").eq("id",user.id).maybeSingle();if(!live)return;if(error){setBlocked("Imeshindikana kuthibitisha akaunti. Tafadhali jaribu tena baadaye.");setChecking(false);return;}if(data?.account_status==="active"&&data?.activation_paid){setChecking(false);return;}if(data?.account_status==="deactivated"||data?.account_status==="banned"){setBlocked("Akaunti yako imesimamishwa. Wasiliana na huduma kwa wateja.");setChecking(false);return;}await navigate({to:"/payment",replace:true});}catch{if(live)setChecking(false)}})();return()=>{live=false}},[navigate]);if(checking)return <main className="auth-page"><section className="auth-content"><p>Inakagua akaunti...</p></section></main>;if(blocked)return <main className="auth-page"><section className="auth-content"><h1>Akaunti imesimamishwa</h1><p className="auth-error">{blocked}</p><a href="/login" className="auth-submit">Ingia tena</a></section></main>;return <Chatdunia/>}
