import importlib.util,json,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('xp_install',Path(__file__).resolve().parents[1]/'scripts/install.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class InstallTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);base=Path(self.tmp.name);m.REPO=base/'repo';m.HOME=base/'home';m.HOME.mkdir();m.REPO.mkdir()
  for root in [m.REPO,m.HOME]:
   (root/m.MOD).mkdir(parents=True);(root/m.MOD/'main.js').write_text('new' if root==m.REPO else 'old');(root/'keys.json').write_text('{}')
   for rel in m.FILES:(root/rel).parent.mkdir(parents=True,exist_ok=True);(root/rel).write_text('new' if root==m.REPO else 'old')
  (m.HOME/m.MOD/'personal.txt').write_text('keep')
 def test_preserves_extras_and_backups(self):
  with patch.object(m.subprocess,'run'):m.install()
  self.assertEqual((m.HOME/m.MOD/'main.js').read_text(),'new');self.assertEqual((m.HOME/m.MOD/'personal.txt').read_text(),'keep');self.assertTrue(list((m.HOME/'backups').glob('*/winxp/main.js')))
 def test_prevalidation_failure_leaves_live_unchanged(self):
  with patch.object(m.subprocess,'run',side_effect=RuntimeError('native failure')):
   with self.assertRaises(RuntimeError):m.install()
  self.assertEqual((m.HOME/m.MOD/'main.js').read_text(),'old');self.assertEqual((m.HOME/m.FILES[0]).read_text(),'old')
 def test_swap_failure_restores_old_folder(self):
  replace=m.os.replace
  def fail(src,dst):
   if Path(src).name=='winxp' and '.winxp-staging-' in str(src):raise OSError('injected swap failure')
   return replace(src,dst)
  with patch.object(m.subprocess,'run'),patch.object(m.os,'replace',side_effect=fail):
   with self.assertRaises(OSError):m.install()
  self.assertEqual((m.HOME/m.MOD/'main.js').read_text(),'old');self.assertEqual((m.HOME/m.FILES[0]).read_text(),'old')
if __name__=='__main__':unittest.main()
