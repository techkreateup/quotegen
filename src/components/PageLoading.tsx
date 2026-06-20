export default function PageLoading({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="relative w-10 h-10">
        <div className="absolute inset-0 rounded-full border-[3px] border-slate-200" />
        <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-indigo-500 animate-spin" />
      </div>
      <p className="text-[13px] text-slate-400 font-medium">{message}</p>
    </div>
  );
}
