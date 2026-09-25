# Prompt

Pulling a repository sometimes fails and we need to address it. A common case: a change is created in the dashboard, its work is merged upstream, and the next pull is refused because the change's files, still staged locally, would be overwritten by the incoming commits. Forcing the pull doesn't help either. The pull should resolve this safely when the blocking files are only the leftovers of such a change, and otherwise explain clearly what is blocking and how to resolve it, without losing local work.
