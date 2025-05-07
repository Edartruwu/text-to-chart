import ChatInterface from "@/components/chat/chatinterface";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col">
      <div className="flex flex-col h-screen">
        <header className="flex items-center justify-between bg-blue-600 text-white p-4">
          <h1 className="text-2xl font-bold">Text to Chart</h1>
        </header>

        <div className="flex-1 overflow-hidden">
          <ChatInterface />
        </div>
      </div>
    </main>
  );
}
