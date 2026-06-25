import 'dotenv/config';
import supabase from '../lib/supabaseClient.js';

const EMAIL    = 'zkfnth01@naver.com';
const PASSWORD = 'k100411*';
const NAME     = '대표';
const PHONE    = '01048468575';   // .env의 ALIGO_SENDER 번호를 기본값으로 사용

async function createAdmin() {
    console.log(`\n👤 [Admin] 계정 생성 시도: ${EMAIL}`);

    // 1. Supabase Auth 가입
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email: EMAIL,
        password: PASSWORD,
    });

    if (authError) {
        // 이미 존재하는 경우 로그인으로 재시도
        if (authError.message.includes('already registered')) {
            console.log('⚠️  이미 등록된 이메일입니다. 로그인 테스트 진행...');
            const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
                email: EMAIL,
                password: PASSWORD,
            });
            if (loginError) {
                console.error('❌ 로그인 실패:', loginError.message);
                process.exit(1);
            }
            console.log('✅ 이미 존재하는 계정으로 로그인 성공!');
            console.log('   이메일 :', EMAIL);
            console.log('   토큰   :', loginData.session.access_token.slice(0, 30) + '...');
            process.exit(0);
        }
        console.error('❌ 가입 실패:', authError.message);
        process.exit(1);
    }

    const userId = authData.user?.id;
    console.log('✅ Auth 계정 생성 완료! UID:', userId);

    // 2. profiles 테이블에 프로필 저장
    const { error: dbError } = await supabase
        .from('profiles')
        .upsert({ id: userId, email: EMAIL, phone: PHONE, name: NAME });

    if (dbError) {
        console.warn('⚠️  profiles 저장 실패 (테이블 없을 수 있음):', dbError.message);
    } else {
        console.log('✅ profiles 테이블 저장 완료!');
    }

    console.log('\n🎉 === 계정 등록 완료 ===');
    console.log('   이메일  :', EMAIL);
    console.log('   비밀번호 :', PASSWORD);
    console.log('   이름     :', NAME);
    console.log('   휴대폰   :', PHONE);
    console.log('\n⚠️  Supabase 이메일 확인이 필요할 수 있습니다.');
    console.log('   Supabase Dashboard → Authentication → Users 에서 "Confirm" 처리하거나');
    console.log('   Authentication 설정에서 "Email confirmation" 을 OFF 하세요.\n');
    process.exit(0);
}

createAdmin().catch(e => { console.error(e); process.exit(1); });
