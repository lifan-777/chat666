package com.campus.market.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.campus.market.TestFixtures;
import com.campus.market.common.BusinessException;
import com.campus.market.config.AppProperties;
import com.campus.market.dto.ChangePasswordRequest;
import com.campus.market.dto.LoginRequest;
import com.campus.market.dto.LoginResponse;
import com.campus.market.dto.RegisterRequest;
import com.campus.market.dto.UpdateProfileRequest;
import com.campus.market.dto.UserVO;
import com.campus.market.entity.Role;
import com.campus.market.entity.User;
import com.campus.market.entity.UserStatus;
import com.campus.market.repository.UserRepository;
import com.campus.market.security.JwtTokenProvider;

@ExtendWith(MockitoExtension.class)
@DisplayName("用户服务 UserService 单元测试")
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder(4);
    private JwtTokenProvider tokenProvider;
    private UserService userService;

    @BeforeEach
    void setUp() {
        tokenProvider = new JwtTokenProvider(new AppProperties(
                new AppProperties.Jwt("unit-test-secret-key-0123456789-abcdefghijklmnopqrstuvwxyz", 1), "./target/x", false));
        userService = new UserService(userRepository, passwordEncoder, tokenProvider);
    }

    private User storedUser(String rawPassword) {
        User u = TestFixtures.user(7, "zhangsan");
        u.setPassword(passwordEncoder.encode(rawPassword));
        return u;
    }

    @Test
    @DisplayName("注册成功：密码加密保存，默认普通用户、状态正常")
    void registerSuccess() {
        when(userRepository.existsByUsername("newuser")).thenReturn(false);
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(100L);
            return u;
        });

        UserVO vo = userService.register(new RegisterRequest("newuser", "123456", " 新同学 ", ""));

        assertThat(vo.id()).isEqualTo(100L);
        assertThat(vo.nickname()).isEqualTo("新同学");
        assertThat(vo.role()).isEqualTo(Role.USER);
        assertThat(vo.status()).isEqualTo(UserStatus.NORMAL);
        assertThat(vo.phone()).isNull();
    }

    @Test
    @DisplayName("注册成功时数据库中不保存明文密码")
    void registerStoresHashedPassword() {
        when(userRepository.existsByUsername("newuser")).thenReturn(false);
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        userService.register(new RegisterRequest("newuser", "123456", "新同学", "13800000000"));

        verify(userRepository).save(org.mockito.ArgumentMatchers.argThat(u ->
                !u.getPassword().equals("123456") && passwordEncoder.matches("123456", u.getPassword())));
    }

    @Test
    @DisplayName("注册失败：用户名已存在返回 409")
    void registerDuplicateUsername() {
        when(userRepository.existsByUsername("zhangsan")).thenReturn(true);

        assertThatThrownBy(() -> userService.register(new RegisterRequest("zhangsan", "123456", "张三", null)))
                .isInstanceOf(BusinessException.class)
                .hasMessage("用户名已被注册")
                .extracting("status").isEqualTo(HttpStatus.CONFLICT);
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("登录成功：返回可解析的 Token 和用户信息")
    void loginSuccess() {
        when(userRepository.findByUsername("zhangsan")).thenReturn(Optional.of(storedUser("123456")));

        LoginResponse response = userService.login(new LoginRequest("zhangsan", "123456"));

        assertThat(response.user().username()).isEqualTo("zhangsan");
        assertThat(tokenProvider.parseUserId(response.token())).contains(7L);
    }

    @Test
    @DisplayName("登录失败：密码错误返回 401")
    void loginWrongPassword() {
        when(userRepository.findByUsername("zhangsan")).thenReturn(Optional.of(storedUser("123456")));

        assertThatThrownBy(() -> userService.login(new LoginRequest("zhangsan", "wrong")))
                .isInstanceOf(BusinessException.class)
                .hasMessage("用户名或密码错误")
                .extracting("status").isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    @DisplayName("登录失败：用户不存在返回 401（与密码错误提示一致，防止枚举用户名）")
    void loginUnknownUser() {
        when(userRepository.findByUsername("nobody")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.login(new LoginRequest("nobody", "123456")))
                .isInstanceOf(BusinessException.class)
                .hasMessage("用户名或密码错误");
    }

    @Test
    @DisplayName("登录失败：被封禁用户返回 403")
    void loginBannedUser() {
        User banned = storedUser("123456");
        banned.setStatus(UserStatus.BANNED);
        when(userRepository.findByUsername("zhangsan")).thenReturn(Optional.of(banned));

        assertThatThrownBy(() -> userService.login(new LoginRequest("zhangsan", "123456")))
                .isInstanceOf(BusinessException.class)
                .extracting("status").isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    @DisplayName("修改资料：昵称去除首尾空格，空手机号保存为 null")
    void updateProfile() {
        User user = storedUser("123456");
        when(userRepository.findById(7L)).thenReturn(Optional.of(user));

        UserVO vo = userService.updateProfile(7L, new UpdateProfileRequest("  小张 ", ""));

        assertThat(vo.nickname()).isEqualTo("小张");
        assertThat(user.getPhone()).isNull();
    }

    @Test
    @DisplayName("修改密码成功：新密码生效")
    void changePasswordSuccess() {
        User user = storedUser("123456");
        when(userRepository.findById(7L)).thenReturn(Optional.of(user));

        userService.changePassword(7L, new ChangePasswordRequest("123456", "654321"));

        assertThat(passwordEncoder.matches("654321", user.getPassword())).isTrue();
    }

    @Test
    @DisplayName("修改密码失败：原密码错误返回 400")
    void changePasswordWrongOld() {
        User user = storedUser("123456");
        when(userRepository.findById(7L)).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> userService.changePassword(7L, new ChangePasswordRequest("000000", "654321")))
                .isInstanceOf(BusinessException.class)
                .hasMessage("原密码错误")
                .extracting("status").isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(passwordEncoder.matches("123456", user.getPassword())).isTrue();
    }

    @Test
    @DisplayName("管理员封禁与解封普通用户")
    void banAndUnbanUser() {
        User user = storedUser("123456");
        when(userRepository.findById(7L)).thenReturn(Optional.of(user));

        assertThat(userService.updateStatus(7L, UserStatus.BANNED).status()).isEqualTo(UserStatus.BANNED);
        assertThat(userService.updateStatus(7L, UserStatus.NORMAL).status()).isEqualTo(UserStatus.NORMAL);
    }

    @Test
    @DisplayName("不能封禁管理员账号")
    void cannotBanAdmin() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(TestFixtures.admin(1)));

        assertThatThrownBy(() -> userService.updateStatus(1L, UserStatus.BANNED))
                .isInstanceOf(BusinessException.class)
                .hasMessage("不能封禁管理员账号");
    }

    @Test
    @DisplayName("查询不存在的用户返回 404")
    void userNotFound() {
        when(userRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.getEntity(99L))
                .isInstanceOf(BusinessException.class)
                .extracting("status").isEqualTo(HttpStatus.NOT_FOUND);
    }
}
