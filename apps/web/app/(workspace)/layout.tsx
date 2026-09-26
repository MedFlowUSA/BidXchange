import { DemoPassportProvider } from '../../components/demo-passport-state';
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <DemoPassportProvider>{children}</DemoPassportProvider>;
}
