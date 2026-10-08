import { getGameData, getUser } from '@/lib/game';
import GameClient from '@/components/GameClient';
export const dynamic='force-dynamic';
export default async function HomePage() {
  const user=await getUser();
  const data=await getGameData(user);
  return <GameClient initialData={data} />;
}
