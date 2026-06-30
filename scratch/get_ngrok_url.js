import http from 'http';

function getNgrokUrl() {
    http.get('http://127.0.0.1:4040/api/tunnels', (res) => {
        let data = '';
        res.on('data', (chunk) => {
            data += chunk;
        });
        res.on('end', () => {
            try {
                const parsed = JSON.parse(data);
                const tunnels = parsed.tunnels || [];
                if (tunnels.length === 0) {
                    console.log('⚠️ No active tunnels found. Waiting...');
                    setTimeout(getNgrokUrl, 2000);
                    return;
                }
                console.log('\n=============================================');
                console.log('🎉 ngrok 외부 접속용 터널이 활성화되었습니다!');
                console.log('=============================================');
                tunnels.forEach((t) => {
                    console.log(`- 프로토콜: ${t.proto.toUpperCase()}`);
                    console.log(`- 외부 접속 주소: ${t.public_url}`);
                    console.log(`- 로컬 연결 대상: ${t.config.addr}`);
                    console.log('---------------------------------------------');
                });
                console.log('위의 [외부 접속 주소]를 휴대폰 브라우저에 입력하시면 밖에서도 접속 가능합니다.');
                console.log('=============================================\n');
            } catch (e) {
                console.error('Failed to parse ngrok response:', e.message);
            }
        });
    }).on('error', (err) => {
        console.log('⏳ ngrok API가 아직 활성화되지 않았습니다. 재시도 중...');
        setTimeout(getNgrokUrl, 2000);
    });
}

// Start polling
getNgrokUrl();
