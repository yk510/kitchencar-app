import LoadingLine from '@/components/LoadingLine'

export default function PublicMobileOrderVerifyingView() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 lg:px-6">
      <section className="soft-panel rounded-[36px] px-6 py-8 text-center lg:px-8">
        <div className="badge-soft badge-blue inline-block">PAYMENT CHECK</div>
        <h1 className="mt-5 text-3xl font-black tracking-tight text-[var(--text-main)]">決済完了を確認しています</h1>
        <p className="mt-4 text-sm leading-7 text-[var(--text-sub)]">
          クレジットカード決済の結果を確認しています。数秒そのままでお待ちください。
        </p>
        <LoadingLine className="mt-6 text-left" label="決済状況を確認しています..." />
      </section>
    </div>
  )
}
