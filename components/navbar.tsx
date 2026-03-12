"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cva } from "class-variance-authority";

const NAVIGATION_MAP = [
  { url: "/", name: "Home" },
  { url: "/download", name: "Download" },
];

interface NavbarLinkProps {
  name: string;
  url: string;
  isActive: boolean;
}
export const navLink = cva(
  `
  relative inline-block px-1 py-2
  transition-colors duration-150
  text-black hover:text-blue-600

  after:content-['']
  after:absolute after:left-0 after:bottom-0.5
  after:h-[3px] after:w-full after:bg-current after:rounded-full
  after:transition-transform after:duration-300
  after:ease-[cubic-bezier(.2,.8,.2,1)]
  `,
  {
    variants: {
      isActive: {
        true: "after:scale-x-100 after:origin-left",
        false:
          "after:scale-x-0 after:origin-center hover:after:scale-x-100 hover:after:origin-left",
      },
    },
    defaultVariants: {
      isActive: false,
    },
  }
);

const NavbarLink = ({ name, url, isActive }: NavbarLinkProps) => (
  <li>
    <Link href={url} className={navLink({ isActive })}>
      {name}
    </Link>
  </li>
);

const Navbar = () => {
  const pathname = usePathname();
  const renderLinks = NAVIGATION_MAP.map((link) => (
    <NavbarLink
      key={link.name}
      name={link.name}
      url={link.url}
      isActive={link.url === pathname}
    />
  ));
  return (
    <nav className="w-full h-12 shadow-lg">
      <ul className="w-full h-full inline-flex gap-3 items-center ml-3 font-bold">
        {renderLinks}
      </ul>
    </nav>
  );
};

export default Navbar;
