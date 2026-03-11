/**
 * Seed script: 15 Knowledge Base articles for NeeFlow
 * Run: npx ts-node --project tsconfig.json prisma/seed-kb-articles.ts
 *   OR: npx tsx prisma/seed-kb-articles.ts
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter }) as any

// ─── Helper ────────────────────────────────────────────────────────────────
function h(tag: string, attrs: string, inner: string) {
    return `<${tag} ${attrs}>${inner}</${tag}>`
}
function section(inner: string) {
    return h('div', 'style="margin-bottom:24px"', inner)
}
function heading(level: number, text: string) {
    const styles: Record<number, string> = {
        2: 'font-size:22px;font-weight:700;color:#1a1a1a;margin:0 0 12px;border-bottom:2px solid #e5e7eb;padding-bottom:8px',
        3: 'font-size:17px;font-weight:600;color:#111;margin:20px 0 8px',
        4: 'font-size:14px;font-weight:600;color:#333;margin:16px 0 6px',
    }
    return h(`h${level}`, `style="${styles[level]}"`, text)
}
function para(text: string) {
    return h('p', 'style="color:#374151;line-height:1.7;margin:0 0 12px;font-size:15px"', text)
}
function tip(text: string, icon = '💡') {
    return h('div', 'style="background:#eff6ff;border-left:4px solid #3b82f6;padding:12px 16px;border-radius:6px;margin:16px 0"',
        h('p', 'style="margin:0;color:#1d4ed8;font-size:14px;line-height:1.5"', `${icon} <strong>Tip:</strong> ${text}`))
}
function warn(text: string) {
    return h('div', 'style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:6px;margin:16px 0"',
        h('p', 'style="margin:0;color:#92400e;font-size:14px;line-height:1.5"', `⚠️ <strong>Lưu ý:</strong> ${text}`))
}
function steps(items: string[]) {
    const lis = items.map((item, i) =>
        h('li', 'style="margin-bottom:8px;color:#374151;font-size:14px;line-height:1.6"',
            h('strong', '', `${i + 1}.`) + ' ' + item)).join('')
    return h('ol', 'style="padding-left:20px;margin:12px 0"', lis)
}
function bullets(items: string[]) {
    const lis = items.map(item =>
        h('li', 'style="margin-bottom:6px;color:#374151;font-size:14px;line-height:1.6"', item)).join('')
    return h('ul', 'style="padding-left:20px;margin:12px 0"', lis)
}
function code(text: string) {
    return h('code', 'style="background:#f3f4f6;border:1px solid #e5e7eb;padding:2px 6px;border-radius:4px;font-family:monospace;font-size:13px;color:#374151"', text)
}
function badge(text: string, color: string) {
    return h('span', `style="background:${color}22;color:${color};border:1px solid ${color}44;padding:2px 8px;border-radius:12px;font-size:12px;font-weight:500;margin-right:4px"`, text)
}

// ─── Article Content ───────────────────────────────────────────────────────

const articles = [

    // ─── GETTING STARTED ──────────────────────────────────────────────────
    {
        title: 'Tạo Channel Đầu Tiên Của Bạn',
        slug: 'tao-channel-dau-tien',
        category: 'getting_started',
        tags: ['channel', 'bắt đầu', 'cài đặt'],
        excerpt: 'Hướng dẫn từng bước để tạo channel và kết nối tài khoản mạng xã hội của bạn vào NeeFlow.',
        content: [
            heading(2, 'Tạo Channel Đầu Tiên Của Bạn'),
            para('Channel là đơn vị trung tâm trong NeeFlow — mỗi channel đại diện cho một thương hiệu hoặc doanh nghiệp và chứa tất cả tài khoản mạng xã hội liên quan.'),
            section(
                heading(3, 'Bước 1: Truy cập trang Channels') +
                steps([
                    'Đăng nhập vào NeeFlow tại <strong>neeflow.com/dashboard</strong>',
                    'Nhấn vào menu <strong>Channels</strong> ở sidebar trái',
                    'Chọn nút <strong>+ New Channel</strong> ở góc trên phải',
                ])
            ),
            section(
                heading(3, 'Bước 2: Điền thông tin Channel') +
                bullets([
                    '<strong>Tên Channel:</strong> Tên thương hiệu hoặc dự án (VD: "Cửa Hàng Hoa ABC")',
                    '<strong>Avatar:</strong> Logo hoặc hình đại diện thương hiệu (tùy chọn)',
                    '<strong>Mô tả:</strong> Mô tả ngắn về channel của bạn',
                    '<strong>Ngôn ngữ nội dung:</strong> Ngôn ngữ chủ yếu bạn sẽ đăng bài',
                ])
            ),
            section(
                heading(3, 'Bước 3: Kết nối mạng xã hội') +
                para('Sau khi tạo channel, bạn sẽ thấy màn hình kết nối platform. Nhấn vào logo của mạng xã hội bạn muốn kết nối:') +
                bullets([
                    badge('Facebook', '#1877f2') + ' Trang Facebook, Nhóm',
                    badge('Instagram', '#e1306c') + ' Tài khoản Business hoặc Creator',
                    badge('TikTok', '#000000') + ' Tài khoản TikTok',
                    badge('YouTube', '#ff0000') + ' Kênh YouTube',
                    badge('LinkedIn', '#0a66c2') + ' Trang công ty',
                ])
            ),
            tip('Bạn có thể kết nối nhiều nền tảng vào cùng một channel. Hãy kết nối tất cả tài khoản liên quan đến một thương hiệu vào cùng một channel để quản lý dễ hơn.'),
            section(
                heading(3, 'Bước 4: Bắt đầu đăng bài') +
                para('Sau khi kết nối xong, Channel của bạn đã sẵn sàng! Vào tab <strong>Compose</strong> để tạo bài viết đầu tiên.')
            ),
            warn('Nếu bạn đang quản lý nhiều thương hiệu khác nhau, hãy tạo một channel riêng cho mỗi thương hiệu thay vì gộp tất cả vào một channel.'),
        ].join('\n'),
    },

    {
        title: 'Kết Nối Facebook & Instagram',
        slug: 'ket-noi-facebook-instagram',
        category: 'getting_started',
        tags: ['facebook', 'instagram', 'kết nối', 'oauth'],
        excerpt: 'Hướng dẫn kết nối tài khoản Facebook và Instagram vào NeeFlow — bao gồm cấp quyền và xử lý lỗi phổ biến.',
        content: [
            heading(2, 'Kết Nối Facebook & Instagram'),
            para('NeeFlow sử dụng Meta Graph API để đăng bài lên Facebook và Instagram. Bạn cần có quyền admin đối với Trang Facebook và tài khoản Instagram Business/Creator.'),
            section(
                heading(3, 'Yêu cầu trước khi bắt đầu') +
                bullets([
                    'Có <strong>Tài khoản Facebook cá nhân</strong> (dùng để đăng nhập)',
                    'Có <strong>Trang Facebook</strong> (Page) — không phải tài khoản cá nhân',
                    'Instagram phải là tài khoản <strong>Business hoặc Creator</strong> và đã <strong>liên kết với Trang Facebook</strong>',
                    'Bạn phải là <strong>Admin</strong> của Trang Facebook đó',
                ])
            ),
            section(
                heading(3, 'Bước kết nối Facebook') +
                steps([
                    'Vào <strong>Channel Settings → Platforms</strong>',
                    'Nhấn nút <strong>Connect Facebook</strong>',
                    'Đăng nhập vào tài khoản Facebook của bạn',
                    'Chọn <strong>tất cả Trang</strong> bạn muốn quản lý (không bỏ bỏ chọn bất kỳ trang nào)',
                    'Chấp nhận <strong>tất cả quyền truy cập</strong> được yêu cầu',
                    'Chọn Trang Facebook cụ thể trong danh sách NeeFlow hiển thị',
                ])
            ),
            tip('Nhớ chọn "Tiếp tục với tư cách..." và cấp tất cả quyền yêu cầu. Nếu bỏ bỏ chọn bất kỳ quyền nào, tính năng đăng bài có thể không hoạt động.'),
            section(
                heading(3, 'Bước kết nối Instagram') +
                para('Instagram được kết nối <strong>thông qua</strong> Trang Facebook đã liên kết:') +
                steps([
                    'Sau khi kết nối Facebook, nhấn <strong>Connect Instagram</strong>',
                    'NeeFlow sẽ tự động tìm tài khoản Instagram liên kết với Trang Facebook của bạn',
                    'Chọn tài khoản Instagram từ danh sách',
                ])
            ),
            warn('Instagram cá nhân không thể kết nối. Bạn cần chuyển sang tài khoản Business hoặc Creator trong phần Cài Đặt tài khoản Instagram của bạn.'),
            section(
                heading(3, 'Xử lý lỗi thường gặp') +
                bullets([
                    '<strong>"Token đã hết hạn"</strong> — Kết nối lại tài khoản trong phần Channel Settings',
                    '<strong>"Không tìm thấy Trang"</strong> — Kiểm tra bạn đã chọn đúng Trang khi cấp quyền Facebook',
                    '<strong>"Instagram không liên kết"</strong> — Vào Instagram App → Settings → Account → Switch to Professional Account',
                    '<strong>"Lỗi 190"</strong> — Token hết hạn, cần kết nối lại',
                ])
            ),
        ].join('\n'),
    },

    {
        title: 'Tổng Quan Dashboard NeeFlow',
        slug: 'tong-quan-dashboard',
        category: 'getting_started',
        tags: ['dashboard', 'giao diện', 'tổng quan'],
        excerpt: 'Khám phá tất cả các khu vực chính của NeeFlow Dashboard và cách sử dụng hiệu quả.',
        content: [
            heading(2, 'Tổng Quan Dashboard NeeFlow'),
            para('Dashboard của NeeFlow được thiết kế để bạn quản lý toàn bộ nội dung mạng xã hội từ một nơi duy nhất. Dưới đây là các khu vực chính.'),
            section(
                heading(3, '🗂️ Sidebar Navigation') +
                bullets([
                    '<strong>Dashboard:</strong> Tổng quan hiệu suất, số liệu, bài viết gần đây',
                    '<strong>Compose:</strong> Soạn và lên lịch bài viết mới',
                    '<strong>Posts:</strong> Quản lý tất cả bài viết (đã đăng, đã lên lịch, bản nháp)',
                    '<strong>Calendar:</strong> Xem kế hoạch đăng bài theo lịch',
                    '<strong>Media:</strong> Thư viện hình ảnh, video của bạn',
                    '<strong>Inbox:</strong> Tin nhắn và bình luận từ tất cả nền tảng',
                    '<strong>Analytics:</strong> Số liệu hiệu suất bài viết',
                    '<strong>Settings:</strong> Cài đặt Channel và tài khoản',
                ])
            ),
            section(
                heading(3, '🔄 Chuyển đổi Channel') +
                para('Ở góc trên cùng sidebar, bạn có thể chuyển đổi giữa các channel. Tất cả dữ liệu (bài viết, lịch, media) được tách biệt theo từng channel.')
            ),
            section(
                heading(3, '📊 Màn hình Dashboard chính') +
                bullets([
                    '<strong>Stats bar:</strong> Tổng bài đăng, tốc độ đăng, số tài khoản kết nối',
                    '<strong>Recent posts:</strong> Các bài mới nhất và trạng thái của chúng',
                    '<strong>Upcoming:</strong> Bài viết sắp được đăng trong 24h tới',
                    '<strong>Quick compose:</strong> Soạn nhanh từ Dashboard',
                ])
            ),
            tip('Dùng phím tắt <strong>Ctrl + N</strong> (hoặc <strong>⌘ + N</strong> trên Mac) để mở Compose Editor nhanh từ bất kỳ trang nào.'),
        ].join('\n'),
    },

    // ─── AI & AUTOMATION ──────────────────────────────────────────────────
    {
        title: 'Sử Dụng AI Compose Editor',
        slug: 'su-dung-ai-compose-editor',
        category: 'ai',
        tags: ['AI', 'compose', 'viết nội dung', 'caption'],
        excerpt: 'Hướng dẫn đầy đủ cách sử dụng AI để tạo nội dung cho nhiều nền tảng cùng lúc.',
        content: [
            heading(2, 'Sử Dụng AI Compose Editor'),
            para('AI Compose Editor là trung tâm sức mạnh của NeeFlow — cho phép bạn tạo nội dung chuyên nghiệp cho Facebook, Instagram, TikTok, LinkedIn... cùng một lúc, với AI được tối ưu riêng cho từng nền tảng.'),
            section(
                heading(3, 'Giao diện 3 cột') +
                bullets([
                    '<strong>Cột trái — Settings:</strong> Chọn channel, platform, giọng điệu, ngôn ngữ',
                    '<strong>Cột giữa — Editor:</strong> Nhập prompt hoặc chỉnh sửa nội dung AI tạo ra',
                    '<strong>Cột phải — Preview:</strong> Xem trước bài viết sẽ trông như thế nào trên từng nền tảng',
                ])
            ),
            section(
                heading(3, 'Tạo nội dung bằng AI') +
                steps([
                    'Chọn <strong>Channel</strong> và các <strong>Platform</strong> muốn đăng (Facebook, Instagram...)',
                    'Nhập <strong>chủ đề</strong> hoặc <strong>ý tưởng</strong> vào ô Prompt',
                    'Chọn <strong>Tone</strong> (Chuyên nghiệp, Vui vẻ, Cảm xúc, v.v.)',
                    'Nhấn nút <strong>✨ Generate</strong>',
                    'AI sẽ tạo nội dung tối ưu cho <em>từng nền tảng bạn đã chọn</em>',
                    'Chỉnh sửa nếu cần, rồi chọn <strong>Post Now</strong> hoặc <strong>Schedule</strong>',
                ])
            ),
            tip('Bạn có thể chọn nhiều platform cùng lúc — AI sẽ tạo phiên bản khác nhau cho từng nền tảng (Instagram dùng hashtag nhiều hơn, LinkedIn dùng ngôn ngữ trang trọng hơn, v.v.)'),
            section(
                heading(3, 'Các loại nội dung AI hỗ trợ') +
                bullets([
                    '📝 <strong>Caption / Post text</strong> — Nội dung văn bản chính',
                    '🖼️ <strong>Image generation</strong> — Tạo hình ảnh từ prompt',
                    '🎨 <strong>Robolly templates</strong> — Áp dụng thiết kế từ template',
                    '🏷️ <strong>Hashtag suggestions</strong> — Gợi ý hashtag phù hợp',
                    '📅 <strong>Optimal timing</strong> — AI gợi ý thời điểm đăng tốt nhất',
                ])
            ),
            section(
                heading(3, 'Tips để AI tạo nội dung tốt hơn') +
                bullets([
                    'Mô tả rõ sản phẩm/dịch vụ, đối tượng khách hàng mục tiêu',
                    'Cung cấp từ khóa quan trọng muốn đưa vào bài',
                    'Chỉ định phong cách (VD: "viết như influencer lifestyle", "chuyên nghiệp như thương hiệu cao cấp")',
                    'Đề cập mục đích bài (tăng tương tác, quảng cáo sản phẩm, thông báo sự kiện...)',
                ])
            ),
        ].join('\n'),
    },

    {
        title: 'Cấu Hình AI API Key (OpenAI / Gemini)',
        slug: 'cau-hinh-ai-api-key',
        category: 'ai',
        tags: ['OpenAI', 'Gemini', 'API key', 'cài đặt AI'],
        excerpt: 'Hướng dẫn lấy API key và kết nối OpenAI hoặc Google Gemini vào NeeFlow để dùng tính năng AI.',
        content: [
            heading(2, 'Cấu Hình AI API Key'),
            para('NeeFlow hỗ trợ nhiều nhà cung cấp AI: OpenAI (GPT-4), Google Gemini, OpenRouter... Bạn cần có API key để sử dụng các tính năng tạo nội dung AI.'),
            section(
                heading(3, 'Cách lấy OpenAI API Key') +
                steps([
                    'Truy cập <strong>platform.openai.com/api-keys</strong>',
                    'Đăng nhập hoặc tạo tài khoản OpenAI',
                    'Nhấn <strong>"Create new secret key"</strong>',
                    'Đặt tên key và sao chép giá trị (chỉ hiển thị 1 lần!)',
                    'Đảm bảo tài khoản có credit — OpenAI dùng hệ thống trả theo lượt',
                ])
            ),
            tip('Bạn có thể dùng tài khoản mới với $5 credit miễn phí từ OpenAI. Để dùng lâu dài hãy nạp thêm tại <strong>platform.openai.com/account/billing</strong>'),
            section(
                heading(3, 'Cách lấy Google Gemini API Key') +
                steps([
                    'Truy cập <strong>aistudio.google.com</strong>',
                    'Đăng nhập bằng tài khoản Google',
                    'Nhấn <strong>"Get API Key"</strong> → <strong>"Create API key"</strong>',
                    'Sao chép API key được tạo ra',
                    'Gemini có gói miễn phí với giới hạn 15 requests/phút',
                ])
            ),
            section(
                heading(3, 'Cài đặt vào NeeFlow') +
                steps([
                    'Vào <strong>Admin → Integrations → AI</strong>',
                    'Nhấn vào card <strong>OpenAI</strong> hoặc <strong>Google Gemini</strong>',
                    'Dán API key vào ô tương ứng',
                    'Nhấn <strong>Save & Test</strong> để xác minh key hoạt động',
                    'Chọn model mặc định (GPT-4o, Gemini Pro...)',
                ])
            ),
            warn('Không chia sẻ API key của bạn với bất kỳ ai. NeeFlow lưu key dưới dạng mã hóa an toàn, nhưng bạn nên regenerate key nếu nghi ngờ bị lộ.'),
        ].join('\n'),
    },

    {
        title: 'Bulk Post Creator — Tạo Hàng Loạt Bài Viết',
        slug: 'bulk-post-creator',
        category: 'ai',
        tags: ['bulk', 'hàng loạt', 'sản phẩm', 'shopify'],
        excerpt: 'Hướng dẫn sử dụng tính năng Bulk Post Creator để tạo và lên lịch nhiều bài viết cùng một lúc.',
        content: [
            heading(2, 'Bulk Post Creator'),
            para('Bulk Post Creator cho phép bạn tạo nhiều bài viết cùng lúc — lý tưởng cho việc lên kế hoạch nội dung hàng tuần hoặc quảng bá nhiều sản phẩm một lúc.'),
            section(
                heading(3, 'Truy cập Bulk Creator') +
                steps([
                    'Vào menu <strong>Posts</strong> trong sidebar',
                    'Chọn tab <strong>Bulk Create</strong> hoặc nhấn nút <strong>Bulk</strong>',
                    'Chọn nguồn nội dung: <strong>Manual</strong>, <strong>Shopify</strong>, hoặc <strong>External</strong>',
                ])
            ),
            section(
                heading(3, 'Tạo từ Shopify') +
                steps([
                    'Chọn nguồn <strong>Shopify Products</strong>',
                    'Chọn các sản phẩm muốn tạo bài (chọn nhiều bằng checkbox)',
                    'Cấu hình template và giọng điệu AI',
                    'Nhấn <strong>Generate All</strong> — AI sẽ tạo caption riêng cho từng sản phẩm',
                    'Xem xét và điều chỉnh từng bài nếu cần',
                    'Nhấn <strong>Schedule All</strong> để lên lịch tự động',
                ])
            ),
            tip('Khi lên lịch Bulk, NeeFlow sẽ tự động phân bổ thời gian đăng để tránh đăng nhiều bài quá gần nhau. Bạn có thể điều chỉnh khoảng cách thời gian trong bước lên lịch.'),
            section(
                heading(3, 'Tạo thủ công') +
                steps([
                    'Chọn nguồn <strong>Manual</strong>',
                    'Nhập danh sách chủ đề/sản phẩm (một dòng một mục)',
                    'AI sẽ tạo caption riêng cho từng mục',
                    'Review và chỉnh sửa trước khi đăng',
                ])
            ),
            warn('Giới hạn tạo hàng loạt phụ thuộc vào gói của bạn. Gói Free được tối đa 10 bài/lần, gói Pro không giới hạn.'),
        ].join('\n'),
    },

    // ─── SCHEDULING ───────────────────────────────────────────────────────
    {
        title: 'Lên Lịch Đăng Bài Tự Động',
        slug: 'len-lich-dang-bai',
        category: 'integrations',
        tags: ['lịch', 'schedule', 'tự động', 'thời gian'],
        excerpt: 'Hướng dẫn lên lịch đăng bài tự động, quản lý qua Calendar view và tối ưu thời gian đăng.',
        content: [
            heading(2, 'Lên Lịch Đăng Bài Tự Động'),
            para('Lên lịch trước giúp bạn duy trì tần suất đăng bài đều đặn mà không cần online liên tục. NeeFlow tự động đăng đúng giờ đã đặt.'),
            section(
                heading(3, 'Lên lịch từ Compose Editor') +
                steps([
                    'Soạn bài viết xong trong Compose Editor',
                    'Thay vì nhấn <strong>Post Now</strong>, nhấn mũi tên bên cạnh → <strong>Schedule</strong>',
                    'Chọn <strong>ngày</strong> và <strong>giờ</strong> muốn đăng',
                    'Chọn <strong>timezone</strong> — mặc định theo timezone của tài khoản bạn',
                    'Nhấn <strong>Schedule Post</strong> để xác nhận',
                ])
            ),
            section(
                heading(3, 'Quản lý lịch qua Calendar View') +
                bullets([
                    'Vào menu <strong>Calendar</strong> để xem tất cả bài viết đã lên lịch',
                    'Kéo thả bài để thay đổi thời gian đăng',
                    'Click vào bài để chỉnh sửa hoặc xóa',
                    'Xem theo tuần hoặc tháng để có cái nhìn tổng thể',
                ])
            ),
            tip('AI của NeeFlow có thể gợi ý thời điểm đăng tốt nhất dựa trên dữ liệu tương tác lịch sử của tài khoản bạn. Chọn <strong>AI Suggest Time</strong> khi lên lịch.'),
            section(
                heading(3, 'Best practices lên lịch') +
                bullets([
                    '<strong>Facebook/Instagram:</strong> 9-11h sáng và 19-21h tối các ngày trong tuần',
                    '<strong>LinkedIn:</strong> Sáng sớm (7-9h) và giờ nghỉ trưa (12-13h)',
                    '<strong>TikTok:</strong> 19-23h tối, đặc biệt thứ 3-5',
                    '<strong>Tần suất:</strong> 1-2 bài/ngày cho Facebook, 1 bài/ngày cho Instagram',
                ])
            ),
        ].join('\n'),
    },

    {
        title: 'Post Approval Workflow — Quy Trình Duyệt Bài',
        slug: 'post-approval-workflow',
        category: 'integrations',
        tags: ['approval', 'duyệt bài', 'workflow', 'team'],
        excerpt: 'Thiết lập quy trình yêu cầu duyệt bài trước khi đăng — phù hợp cho team làm việc nhiều người.',
        content: [
            heading(2, 'Post Approval Workflow'),
            para('Post Approval cho phép Admin kiểm soát nội dung trước khi đăng lên mạng xã hội — hữu ích khi bạn có team content và muốn đảm bảo chất lượng.'),
            section(
                heading(3, 'Các chế độ Approval') +
                bullets([
                    badge('None', '#6b7280') + ' <strong>Không yêu cầu duyệt</strong> — Bài đăng ngay sau khi tạo (mặc định)',
                    badge('Optional', '#f59e0b') + ' <strong>Tùy chọn</strong> — Người tạo chọn có cần duyệt không',
                    badge('Required', '#ef4444') + ' <strong>Bắt buộc</strong> — MỌI bài viết đều phải được admin duyệt trước khi đăng',
                ])
            ),
            section(
                heading(3, 'Cách bật Approval Mode') +
                steps([
                    'Vào <strong>Channel Settings → Content Policy</strong>',
                    'Tìm phần <strong>Post Approval</strong>',
                    'Chọn chế độ: None / Optional / Required',
                    'Nhấn <strong>Save</strong>',
                ])
            ),
            section(
                heading(3, 'Quy trình khi bài cần duyệt') +
                steps([
                    'Người tạo bài viết → Bài ở trạng thái ' + badge('PENDING APPROVAL', '#f59e0b'),
                    'Admin nhận thông báo có bài chờ duyệt',
                    'Admin xem bài trong <strong>Posts → Pending</strong>',
                    'Admin nhấn <strong>Approve</strong> hoặc <strong>Reject</strong> (có thể kèm ghi chú)',
                    'Nếu Approved và đã lên lịch → Bài sẽ được đăng đúng giờ',
                ])
            ),
            tip('Thêm ghi chú khi Reject để người tạo hiểu cần chỉnh sửa gì. Điều này giúp cải thiện chất lượng nội dung theo thời gian.'),
        ].join('\n'),
    },

    // ─── INTEGRATIONS ─────────────────────────────────────────────────────
    {
        title: 'Kết Nối Shopify — Sync Sản Phẩm',
        slug: 'ket-noi-shopify',
        category: 'integrations',
        tags: ['shopify', 'ecommerce', 'sản phẩm', 'sync'],
        excerpt: 'Cách kết nối cửa hàng Shopify vào NeeFlow để tự động đồng bộ sản phẩm và tạo nội dung.',
        content: [
            heading(2, 'Kết Nối Shopify'),
            para('Tích hợp Shopify cho phép bạn import sản phẩm từ cửa hàng và dùng AI để tự động tạo bài quảng cáo từ thông tin sản phẩm.'),
            section(
                heading(3, 'Bước 1: Lấy thông tin kết nối từ Shopify') +
                steps([
                    'Đăng nhập vào Shopify Admin của bạn',
                    'Vào <strong>Settings → Apps and sales channels → Develop apps</strong>',
                    'Nhấn <strong>Create an app</strong>, đặt tên (VD: "NeeFlow")',
                    'Trong tab <strong>Configuration</strong>, chọn các quyền: <code>read_products</code>, <code>read_product_listings</code>',
                    'Vào tab <strong>API credentials</strong>, nhấn <strong>Install app</strong>',
                    'Sao chép <strong>Admin API access token</strong>',
                ])
            ),
            section(
                heading(3, 'Bước 2: Kết nối trong NeeFlow') +
                steps([
                    'Vào <strong>Integrations → E-commerce → Shopify</strong>',
                    'Nhập <strong>Store URL</strong> (VD: mystore.myshopify.com)',
                    'Nhập <strong>Admin API Access Token</strong>',
                    'Nhấn <strong>Test Connection</strong>',
                    'Nếu thành công, nhấn <strong>Save & Sync</strong>',
                ])
            ),
            section(
                heading(3, 'Sử dụng sản phẩm đã sync') +
                bullets([
                    'Vào <strong>Compose → Shopify Product</strong> để chọn sản phẩm',
                    'AI tự động đọc tên, mô tả, giá, hình ảnh sản phẩm',
                    'Tạo caption quảng cáo chỉ trong vài giây',
                    'Import hình ảnh sản phẩm trực tiếp vào bài viết',
                ])
            ),
            tip('Dùng Bulk Post Creator với nguồn Shopify để tạo bài quảng cáo cho toàn bộ catalog sản phẩm cùng một lúc!'),
        ].join('\n'),
    },

    {
        title: 'Cài Đặt Google Drive — Import Media',
        slug: 'cai-dat-google-drive',
        category: 'integrations',
        tags: ['google drive', 'media', 'import', 'hình ảnh'],
        excerpt: 'Kết nối Google Drive để import hình ảnh và video trực tiếp vào Media Library của NeeFlow.',
        content: [
            heading(2, 'Cài Đặt Google Drive'),
            para('Tích hợp Google Drive cho phép bạn duyệt và import media từ Drive trực tiếp vào bài viết, không cần tải về máy rồi upload lại.'),
            section(
                heading(3, 'Kết nối Google Drive') +
                steps([
                    'Vào <strong>Admin → Integrations → Storage → Google Drive</strong>',
                    'Nhấn <strong>Connect with Google</strong>',
                    'Đăng nhập bằng tài khoản Google chứa media',
                    'Chấp nhận quyền truy cập Google Drive',
                    'NeeFlow sẽ kết nối thành công',
                ])
            ),
            section(
                heading(3, 'Sử dụng Google Drive trong bài viết') +
                steps([
                    'Khi soạn bài, nhấn nút <strong>📁 Media</strong> trong Compose Editor',
                    'Chọn tab <strong>Google Drive</strong>',
                    'Duyệt thư mục Drive của bạn',
                    'Chọn file muốn dùng và nhấn <strong>Insert</strong>',
                ])
            ),
            tip('Tổ chức ảnh theo thư mục trong Drive (VD: /NeeFlow/Products/, /NeeFlow/Events/) để dễ tìm kiếm hơn.'),
            warn('Chỉ hỗ trợ các định dạng: JPG, PNG, GIF, MP4, MOV. File kích thước tối đa 100MB.'),
        ].join('\n'),
    },

    // ─── BILLING ──────────────────────────────────────────────────────────
    {
        title: 'Các Gói Dịch Vụ & Tính Năng',
        slug: 'cac-goi-dich-vu',
        category: 'billing',
        tags: ['pricing', 'gói', 'tính năng', 'free', 'pro'],
        excerpt: 'So sánh chi tiết các gói Free, Pro và Enterprise — giúp bạn chọn gói phù hợp nhất.',
        content: [
            heading(2, 'Các Gói Dịch Vụ NeeFlow'),
            section(
                heading(3, '🆓 Gói Free') +
                bullets([
                    '1 Channel',
                    '3 tài khoản mạng xã hội',
                    '10 bài viết đã lên lịch',
                    'AI tạo nội dung: 30 lần/tháng',
                    'Media Library: 500MB',
                    'Support qua ticket',
                ])
            ),
            section(
                heading(3, '⭐ Gói Pro') +
                bullets([
                    '5 Channels',
                    'Không giới hạn tài khoản mạng xã hội',
                    'Không giới hạn bài viết lên lịch',
                    'AI tạo nội dung: 500 lần/tháng',
                    'Bulk Post Creator',
                    'Shopify & WooCommerce integration',
                    'Analytics nâng cao',
                    'Media Library: 10GB',
                    'Priority support',
                ])
            ),
            section(
                heading(3, '🏢 Gói Enterprise') +
                bullets([
                    'Không giới hạn Channels',
                    'AI không giới hạn (với API key riêng)',
                    'Custom branding (white-label)',
                    'Multi-user & Team management',
                    'API access',
                    'Dedicated account manager',
                    'SLA đảm bảo uptime',
                    'Custom onboarding',
                ])
            ),
            tip('Bạn có thể nâng cấp gói bất kỳ lúc nào và chỉ trả tiền theo tỷ lệ ngày còn lại trong chu kỳ billing hiện tại.'),
        ].join('\n'),
    },

    {
        title: 'Nâng Cấp & Hủy Gói Đăng Ký',
        slug: 'nang-cap-huy-goi',
        category: 'billing',
        tags: ['nâng cấp', 'hủy', 'subscription', 'billing', 'thanh toán'],
        excerpt: 'Hướng dẫn nâng cấp lên gói cao hơn, hủy đăng ký và xử lý các vấn đề thanh toán.',
        content: [
            heading(2, 'Nâng Cấp & Hủy Gói Đăng Ký'),
            section(
                heading(3, 'Nâng cấp gói') +
                steps([
                    'Vào <strong>Settings → Billing</strong>',
                    'Chọn gói muốn nâng cấp và nhấn <strong>Upgrade</strong>',
                    'Nhập thông tin thẻ hoặc dùng thẻ đã lưu',
                    'Xác nhận thanh toán',
                    'Gói mới có hiệu lực ngay lập tức',
                ])
            ),
            tip('Khi nâng cấp giữa chu kỳ billing, bạn chỉ trả số ngày còn lại theo tỷ lệ — không bị mất tiền đã thanh toán.'),
            section(
                heading(3, 'Hủy gói') +
                steps([
                    'Vào <strong>Settings → Billing → Manage Subscription</strong>',
                    'Nhấn <strong>Cancel Subscription</strong>',
                    'Chọn lý do hủy (giúp chúng tôi cải thiện dịch vụ)',
                    'Xác nhận hủy',
                    'Gói hiện tại vẫn có hiệu lực đến hết chu kỳ billing đã thanh toán',
                ])
            ),
            section(
                heading(3, 'Xử lý lỗi thanh toán') +
                bullets([
                    '<strong>Thẻ bị từ chối:</strong> Kiểm tra số dư hoặc liên hệ ngân hàng, cập nhật thẻ mới trong Billing',
                    '<strong>Không nhận email invoice:</strong> Kiểm tra thư mục spam/junk',
                    '<strong>Cần hoàn tiền:</strong> Liên hệ support trong vòng 14 ngày kể từ khi thanh toán',
                ])
            ),
            warn('Sau khi hủy và hết chu kỳ, tài khoản sẽ về gói Free. Dữ liệu sẽ được giữ nguyên nhưng một số tính năng sẽ bị vô hiệu hóa.'),
        ].join('\n'),
    },

    // ─── TROUBLESHOOTING ──────────────────────────────────────────────────
    {
        title: 'Tại Sao Bài Viết Không Được Đăng?',
        slug: 'bai-viet-khong-duoc-dang',
        category: 'troubleshooting',
        tags: ['debug', 'lỗi', 'đăng bài', 'troubleshoot'],
        excerpt: 'Checklist đầy đủ để debug khi bài viết không được đăng lên mạng xã hội đúng giờ.',
        content: [
            heading(2, 'Bài Viết Không Được Đăng — Checklist Debug'),
            para('Nếu bài viết đã lên lịch nhưng không được đăng, hãy kiểm tra từng bước dưới đây:'),
            section(
                heading(3, '1. Kiểm tra trạng thái bài viết') +
                bullets([
                    'Vào <strong>Posts → Scheduled</strong> và tìm bài viết của bạn',
                    'Xem cột <strong>Status</strong> — nếu có icon lỗi, hover vào để xem thông báo chi tiết',
                    badge('FAILED', '#ef4444') + ' = Đã cố đăng nhưng thất bại — xem lý do cụ thể',
                    badge('PENDING', '#f59e0b') + ' = Đang chờ đăng hoặc chờ duyệt',
                ])
            ),
            section(
                heading(3, '2. Kiểm tra kết nối tài khoản') +
                bullets([
                    'Vào <strong>Channel Settings → Platforms</strong>',
                    'Kiểm tra tài khoản đích có hiển thị ' + badge('Connected', '#22c55e') + ' không',
                    'Nếu hiển thị ' + badge('Expired', '#ef4444') + ' — cần kết nối lại tài khoản',
                    'Token Facebook/Instagram thường hết hạn sau 60 ngày',
                ])
            ),
            section(
                heading(3, '3. Kiểm tra nội dung bài viết') +
                bullets([
                    '<strong>Facebook:</strong> Không cho phép link rút gọn bit.ly, kiểm tra nội dung có vi phạm Community Standards không',
                    '<strong>Instagram:</strong> Hình ảnh phải ít nhất 400x400px; video tối đa 60 giây với Reels',
                    '<strong>TikTok:</strong> Video phải từ 3-60 giây; không được dùng nhạc có bản quyền',
                    '<strong>LinkedIn:</strong> Hình ảnh tối thiểu 200x200px',
                ])
            ),
            section(
                heading(3, '4. Kiểm tra Approval Mode') +
                para('Nếu Channel đang bật chế độ <strong>Required Approval</strong>, bài chỉ được đăng sau khi Admin duyệt. Vào <strong>Posts → Pending Approval</strong> để xem.')
            ),
            tip('Nếu đã kiểm tra tất cả và vẫn không được, hãy tạo Support Ticket và gửi kèm Post ID — team kỹ thuật sẽ kiểm tra log hệ thống.'),
        ].join('\n'),
    },

    {
        title: 'Lỗi Kết Nối Mạng Xã Hội — Token Hết Hạn',
        slug: 'loi-ket-noi-token-het-han',
        category: 'troubleshooting',
        tags: ['token', 'lỗi kết nối', 're-auth', 'facebook', 'instagram'],
        excerpt: 'Cách xử lý khi token đăng nhập mạng xã hội hết hạn và các bước kết nối lại.',
        content: [
            heading(2, 'Lỗi Kết Nối — Token Hết Hạn'),
            para('Token là mã xác thực giúp NeeFlow đăng bài thay mặt bạn. Token có thể hết hạn hoặc bị thu hồi trong một số trường hợp.'),
            section(
                heading(3, 'Khi nào token hết hạn?') +
                bullets([
                    '<strong>Facebook/Instagram:</strong> Token user ngắn hạn (1-2 giờ), token page dài hạn (60 ngày)',
                    '<strong>TikTok:</strong> Token hết hạn sau 24 giờ không hoạt động',
                    '<strong>LinkedIn:</strong> Token hết hạn sau 60 ngày',
                    'Bạn đổi mật khẩu tài khoản mạng xã hội',
                    'Bạn thu hồi quyền truy cập của app trong cài đặt mạng xã hội',
                    'Tài khoản bị khóa tạm thời hoặc cần xác minh',
                ])
            ),
            section(
                heading(3, 'Cách kết nối lại') +
                steps([
                    'Vào <strong>Channel Settings → Platforms</strong>',
                    'Tìm tài khoản hiển thị trạng thái ' + badge('Token Expired', '#ef4444') + ' hoặc ' + badge('Disconnected', '#ef4444'),
                    'Nhấn nút <strong>Reconnect</strong> hoặc <strong>Re-authenticate</strong>',
                    'Hoàn thành lại quy trình đăng nhập OAuth',
                    'Sau khi reconnect, các bài đã lên lịch sẽ tiếp tục được đăng bình thường',
                ])
            ),
            tip('Đặt lịch nhắc nhở kiểm tra kết nối định kỳ (mỗi 50 ngày) để tránh bị gián đoạn đăng bài do token hết hạn.'),
            section(
                heading(3, 'Lỗi thường gặp và xử lý') +
                bullets([
                    code('Error 190') + ' — Token đã hết hạn, kết nối lại',
                    code('Error 200') + ' — Không đủ quyền, cần re-auth và cấp thêm permissions',
                    code('Error 341') + ' — Vượt quá giới hạn đăng bài của nền tảng, thử lại sau 1 giờ',
                    code('Error 368') + ' — Nội dung vi phạm chính sách, cần sửa nội dung bài',
                ])
            ),
        ].join('\n'),
    },

    {
        title: 'Giới Hạn API & Quota Theo Gói',
        slug: 'gioi-han-api-quota',
        category: 'troubleshooting',
        tags: ['quota', 'giới hạn', 'rate limit', 'API'],
        excerpt: 'Bảng tóm tắt giới hạn sử dụng theo gói và cách xử lý khi vượt quá quota.',
        content: [
            heading(2, 'Giới Hạn API & Quota'),
            para('Mỗi gói NeeFlow có giới hạn sử dụng khác nhau. Hiểu rõ giới hạn giúp bạn lập kế hoạch nội dung phù hợp.'),
            section(
                heading(3, 'Giới hạn theo tính năng') +
                h('table', 'style="width:100%;border-collapse:collapse;font-size:13px"',
                    h('thead', '',
                        h('tr', 'style="background:#f3f4f6"',
                            ['Tính năng', 'Free', 'Pro', 'Enterprise'].map(t =>
                                h('th', 'style="text-align:left;padding:8px;border:1px solid #e5e7eb"', t)
                            ).join('')
                        )
                    ) +
                    h('tbody', '',
                        [
                            ['Channels', '1', '5', 'Không giới hạn'],
                            ['AI Generate/tháng', '30', '500', 'Không giới hạn'],
                            ['Bài lên lịch', '10', 'Không giới hạn', 'Không giới hạn'],
                            ['Bulk create/lần', '-', '100', '500'],
                            ['Media storage', '500MB', '10GB', '100GB'],
                            ['API key riêng', '✗', '✓', '✓'],
                        ].map(row =>
                            h('tr', '',
                                row.map(cell =>
                                    h('td', 'style="padding:8px;border:1px solid #e5e7eb"', cell)
                                ).join('')
                            )
                        ).join('')
                    )
                )
            ),
            section(
                heading(3, 'Khi vượt quá quota AI') +
                bullets([
                    'Thông báo cảnh báo hiển thị khi còn 10% quota',
                    'Khi hết quota, tính năng AI sẽ tạm thời dừng đến đầu tháng sau',
                    'Bạn vẫn có thể soạn và đăng bài thủ công khi hết quota AI',
                    'Có thể nâng cấp gói bất kỳ lúc nào để tăng quota',
                ])
            ),
            tip('Dùng API key riêng (OpenAI/Gemini) trong phần Integrations để bypass giới hạn quota của NeeFlow — API key riêng không bị tính vào quota gói.'),
            section(
                heading(3, 'Rate limits của các nền tảng mạng xã hội') +
                bullets([
                    '<strong>Facebook:</strong> 200 API calls/giờ mỗi page',
                    '<strong>Instagram:</strong> 200 API calls/giờ mỗi tài khoản',
                    '<strong>TikTok:</strong> 100 requests/phút',
                    '<strong>LinkedIn:</strong> 100 requests/ngày mỗi ứng dụng',
                ])
            ),
        ].join('\n'),
    },
]

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
    // Find admin user
    const admin = await prisma.user.findFirst({
        where: { role: 'ADMIN' },
        select: { id: true, email: true },
    })
    if (!admin) {
        console.error('❌ No ADMIN user found. Run seed.ts first to create admin user.')
        process.exit(1)
    }
    console.log(`👤 Using admin: ${admin.email}`)

    let created = 0
    let skipped = 0

    for (const article of articles) {
        const existing = await prisma.supportArticle.findFirst({
            where: { slug: article.slug },
        })
        if (existing) {
            console.log(`⏭️  Skip (exists): ${article.slug}`)
            skipped++
            continue
        }

        await prisma.supportArticle.create({
            data: {
                title: article.title,
                slug: article.slug,
                excerpt: article.excerpt,
                content: article.content,
                metaDesc: article.excerpt,
                category: article.category,
                tags: article.tags,
                status: 'published',
                publishedAt: new Date(),
                authorId: admin.id,
                viewCount: 0,
                helpfulCount: 0,
                notHelpfulCount: 0,
            },
        })
        console.log(`✅ Created: ${article.title}`)
        created++
    }

    console.log(`\n🎉 Done! Created: ${created}, Skipped (already exists): ${skipped}`)
}

main()
    .then(async () => {
        await prisma.$disconnect()
        await pool.end()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        await pool.end()
        process.exit(1)
    })
