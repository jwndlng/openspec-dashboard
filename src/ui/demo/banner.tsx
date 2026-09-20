const REPOSITORY_URL = "https://github.com/jwndlng/openspec-dashboard";

export function DemoBanner() {
  return (
    <div class="demo-banner" role="note">
      <strong>Demo</strong>
      <span>sample data, nothing is saved — reload to start over</span>
      <a href={REPOSITORY_URL}>Get the dashboard →</a>
    </div>
  );
}
