import os,re
D=os.path.dirname(os.path.abspath(__file__)); S=os.path.join(D,'src')
rd=lambda f:open(os.path.join(S,f)).read()
head='<title>Mission Architect</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&family=Chakra+Petch:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">\n<style>'+rd('style.css')+'</style>\n'
three='<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>\n<script>window.THREE||document.write(\'<script src="three.min.js"><\\/script>\')</script>\n<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js"></script>\n<script>(window.THREE&&THREE.GLTFLoader)||document.write(\'<script src="GLTFLoader.js"><\\/script>\')</script>\n'
js='<script>\n'+rd('data.js')+'\n'+rd('i18n_ar.js')+'\n'+rd('i18n.js')+'\n'+rd('space3d.js')+'\n'+rd('app.js')+'\n</script>\n'
page=head+rd('body.html')+three+js
open(os.path.join(D,'index.html'),'w').write(page)
# standalone version for the repo / offline use
a=page.index('<style>'); b=page.index('</style>')+8
full='<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'+page[:b]+'\n</head>\n<body>\n'+page[b:]+'</body>\n</html>\n'
open(os.path.join(D,'standalone.html'),'w').write(full)
print('built', len(page))
