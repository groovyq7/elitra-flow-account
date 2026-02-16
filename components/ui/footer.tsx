import Link from "next/link";

export function AppFooter() {
  return (
    <footer className="w-full border-t bg-white py-6 mt-12">
      <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4 px-4">
        <div className="text-sm text-gray-500">© {new Date().getFullYear()} Elitra. All rights reserved.</div>
        <nav className="flex gap-6 text-sm font-medium">
          <a href="https://elitras-organization.gitbook.io/elitra" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 transition-colors">Docs</a>
          <a href="https://x.com/elitraxyz" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 transition-colors">X</a>
          <a href="https://t.me/elitraxyz" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 transition-colors">Telegram</a>
          {/* <a href="https://citrea.xyz/faucet" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 transition-colors">Faucet</a> */}
          {/* <Link href="/faq" className="hover:text-blue-600 transition-colors">FAQ</Link> */}
        </nav>
      </div>
    </footer>
  );
}
