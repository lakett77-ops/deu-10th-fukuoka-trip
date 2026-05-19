import { tunnelmole } from "tunnelmole";

const port = Number(process.env.PORT || 5173);

const url = await tunnelmole({
  port,
});

console.log(`PUBLIC_URL=${url}`);
console.log(`PORT=${port}`);
console.log("SHARE_HINT=이 주소를 카카오톡에 보내면 친구들이 같이 접속할 수 있어요.");
