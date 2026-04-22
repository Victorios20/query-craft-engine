import QueryValidatorWorkbench from "@/components/query-validator-workbench";

export default function Home() {
  return (
    <main className="flex flex-1">
      <section className="mx-auto w-full max-w-6xl flex-1 px-4 pb-12 pt-8 sm:px-6 lg:px-8">
        <QueryValidatorWorkbench />
      </section>
    </main>
  );
}
