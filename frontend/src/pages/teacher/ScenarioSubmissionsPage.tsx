import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { Alert } from "../../components/Alert";
import { Badge } from "../../components/Badge";
import { BackLink } from "../../components/BackLink";
import { Button } from "../../components/Button";
import { PillSearch, PillSelect, SearchIcon } from "../../components/controls";
import { Spinner } from "../../components/Spinner";
import { getScenario, listScenarioSubmissions } from "../../api";
import type { SubmissionFilters } from "../../api";
import { useAsync } from "../../hooks/useAsync";
import { STATUS_LABEL, formatDate } from "../../lib/format";

const PAGE_SIZE = 10;

// Every submitted conversation for one scenario, as a table, one page at a time.
export function ScenarioSubmissionsPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const scenario = useAsync(() => getScenario(id), id);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SubmissionFilters["sort"]>("newest");
  const [page, setPage] = useState(1);

  // Searches once typing pauses, and goes back to the first page when the search changes.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const submissions = useAsync(
    () => listScenarioSubmissions(id, { q: query, sort, offset: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE }),
    `${id}|${query}|${sort}|${page}`,
  );

  const total = submissions.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const first = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-6">
        <BackLink to="/teacher">Dashboard</BackLink>
        <h1 className="text-4xl leading-tight">{scenario.data?.title ?? "Submissions"}</h1>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="md:w-96">
          <PillSearch
            type="search"
            aria-label="Search by learner email"
            placeholder="Search by learner email"
            icon={<SearchIcon />}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <PillSelect
          aria-label="Sort by time"
          value={sort}
          onChange={(event) => {
            setSort(event.target.value as SubmissionFilters["sort"]);
            setPage(1);
          }}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </PillSelect>
      </div>

      {submissions.error && <Alert>{submissions.error}</Alert>}
      {submissions.loading && <Spinner />}

      {submissions.data && total === 0 && (
        <p className="text-muted">
          {query ? "No submissions match this search." : "No learner has submitted a conversation for this scenario yet."}
        </p>
      )}

      {submissions.data && total > 0 && (
        <div className="flex flex-col gap-5">
          <div className="overflow-x-auto rounded-lg border border-hairline bg-canvas">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-hairline text-xs uppercase tracking-widest text-muted">
                <tr>
                  <th className="px-6 py-4 font-medium">Learner</th>
                  <th className="px-6 py-4 font-medium">Submitted</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {submissions.data.items.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => navigate(`/teacher/conversations/${item.id}`)}
                    className="cursor-pointer transition-colors hover:bg-card"
                  >
                    <td className="px-6 py-4 text-base text-ink">
                      <Link
                        to={`/teacher/conversations/${item.id}`}
                        onClick={(event) => event.stopPropagation()}
                        className="hover:underline"
                      >
                        {item.learner_email}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-muted">{formatDate(item.created_at)}</td>
                    <td className="px-6 py-4">
                      <Badge tone="success">{STATUS_LABEL[item.status]}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-muted">
            <span>
              Showing {first}–{last} of {total}
            </span>
            <div className="flex items-center gap-3">
              <Button variant="secondary" className="h-9 px-4 text-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <span>
                Page {page} of {totalPages}
              </span>
              <Button
                variant="secondary"
                className="h-9 px-4 text-sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
