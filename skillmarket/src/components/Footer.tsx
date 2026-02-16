import Link from "next/link";
import Logo from "./Logo";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-bg-secondary/50">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <Logo size={32} />
              <span className="font-serif text-lg">monAlpha</span>
            </div>
            <p className="text-sm text-text-tertiary leading-relaxed">
              Community-powered AI research intelligence for the Monad ecosystem.
            </p>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">Product</h4>
            <div className="flex flex-col gap-2.5">
              <FooterLink href="/analyze">Analyze Token</FooterLink>
              <FooterLink href="/marketplace">Marketplace</FooterLink>
              <FooterLink href="/create">Create Model</FooterLink>
              <FooterLink href="/dashboard">Dashboard</FooterLink>
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">Resources</h4>
            <div className="flex flex-col gap-2.5">
              <FooterLink href="#">Documentation</FooterLink>
              <FooterLink href="#">SKILL.md Spec</FooterLink>
              <FooterLink href="#">API Reference</FooterLink>
              <FooterLink href="#">GitHub</FooterLink>
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">Community</h4>
            <div className="flex flex-col gap-2.5">
              <FooterLink href="#">Discord</FooterLink>
              <FooterLink href="#">Twitter</FooterLink>
              <FooterLink href="#">Telegram</FooterLink>
              <FooterLink href="#">Blog</FooterLink>
            </div>
          </div>
        </div>
        <div className="pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-text-tertiary">
            &copy; 2026 monAlpha. Built on Monad.
          </p>
          <div className="flex items-center gap-6">
            <span className="text-xs text-text-tertiary">Powered by DeepSeek V3</span>
            <span className="text-xs text-text-tertiary">&bull;</span>
            <span className="text-xs text-text-tertiary">Data from nad.fun</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-sm text-text-secondary hover:text-text-primary transition-colors">
      {children}
    </Link>
  );
}
