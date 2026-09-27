const mutation = process.env.HBP09_010_MUTATION;
if (!['disable-art', 'disable-collab'].includes(mutation)) {
  throw new Error('Set HBP09_010_MUTATION to disable-art or disable-collab before using this isolated mutation preloader.');
}
const { PROGRAMS } = await import('../../lib/simulator/hbp09/programs.mjs');
const key = mutation === 'disable-art' ? '010:art0' : '010:keyword';
if (!Object.hasOwn(PROGRAMS, key)) throw new Error(`Cannot apply mutation; missing handler ${key}`);
delete PROGRAMS[key];
process.stderr.write(`MUTATION_APPLIED ${mutation} (${key}) in this Node process only\n`);
