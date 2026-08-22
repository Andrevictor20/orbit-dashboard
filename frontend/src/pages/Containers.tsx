import { ContainerList } from '../components/ui/ContainerList';

export function Containers() {
  return (
    <div className="h-full flex flex-col">
      <div className="shad-card p-6 flex-1 flex flex-col">
        <ContainerList />
      </div>
    </div>
  );
}
