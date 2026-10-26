package com.campus.market.service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import com.campus.market.common.BusinessException;
import com.campus.market.common.PageResult;
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

/**
 * 用户注册、登录、个人信息维护，以及管理员的用户管理。
 */
@Service
@Transactional
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;

    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder,
                       JwtTokenProvider tokenProvider) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.tokenProvider = tokenProvider;
    }

    public UserVO register(RegisterRequest request) {
        if (userRepository.existsByUsername(request.username())) {
            throw BusinessException.conflict("用户名已被注册");
        }
        User user = new User();
        user.setUsername(request.username());
        user.setPassword(passwordEncoder.encode(request.password()));
        user.setNickname(request.nickname().trim());
        user.setPhone(StringUtils.hasText(request.phone()) ? request.phone() : null);
        user.setRole(Role.USER);
        user.setStatus(UserStatus.NORMAL);
        return UserVO.from(userRepository.save(user));
    }

    @Transactional(readOnly = true)
    public LoginResponse login(LoginRequest request) {
        User user = userRepository.findByUsername(request.username())
                .filter(u -> passwordEncoder.matches(request.password(), u.getPassword()))
                .orElseThrow(() -> BusinessException.unauthorized("用户名或密码错误"));
        if (user.isBanned()) {
            throw BusinessException.forbidden("账号已被封禁，请联系管理员");
        }
        return new LoginResponse(tokenProvider.createToken(user.getId()), UserVO.from(user));
    }

    public UserVO updateProfile(Long userId, UpdateProfileRequest request) {
        User user = getEntity(userId);
        user.setNickname(request.nickname().trim());
        user.setPhone(StringUtils.hasText(request.phone()) ? request.phone() : null);
        return UserVO.from(user);
    }

    public void changePassword(Long userId, ChangePasswordRequest request) {
        User user = getEntity(userId);
        if (!passwordEncoder.matches(request.oldPassword(), user.getPassword())) {
            throw BusinessException.badRequest("原密码错误");
        }
        user.setPassword(passwordEncoder.encode(request.newPassword()));
    }

    @Transactional(readOnly = true)
    public PageResult<UserVO> search(String keyword, int page, int size) {
        PageRequest pageable = PageRequest.of(Math.max(page, 1) - 1, size, Sort.by(Sort.Direction.DESC, "id"));
        Page<User> result = StringUtils.hasText(keyword)
                ? userRepository.findByUsernameContainingOrNicknameContaining(keyword.trim(), keyword.trim(), pageable)
                : userRepository.findAll(pageable);
        return PageResult.of(result, UserVO::from);
    }

    /**
     * 管理员封禁 / 解封用户。管理员账号不能被封禁。
     */
    public UserVO updateStatus(Long targetUserId, UserStatus status) {
        User user = getEntity(targetUserId);
        if (user.isAdmin() && status == UserStatus.BANNED) {
            throw BusinessException.badRequest("不能封禁管理员账号");
        }
        user.setStatus(status);
        return UserVO.from(user);
    }

    @Transactional(readOnly = true)
    public User getEntity(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> BusinessException.notFound("用户不存在"));
    }
}
