// src/components/ui/Footer.tsx

export default function Footer() {
  return (
    <footer className="py-6 px-4 text-xs bg-base-100 text-base-content/80">
      <div className="max-w-6xl mx-auto flex justify-center">
        <p>
          &copy; 2026 Made by{' '}
          <a
            href="https://www.xyra.network/"
            className="underline underline-offset-2 hover:text-primary"
            target="_blank"
            rel="noopener noreferrer"
          >
            Xyra Network
          </a>
        </p>
      </div>
    </footer>
  );
}
